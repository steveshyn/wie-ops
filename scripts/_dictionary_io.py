"""
Minimal YAML reader tailored to data_dictionary.yaml's shape.

Why not PyYAML: avoiding a pip install requirement in wie-ops CI so the
verifier can run with the system Python 3. The dictionary file is the only
YAML this repo consumes, and its shape is controlled by us.

Supported subset:
  - Scalars (strings, ints, booleans).
  - Mappings with `key: value` or `key:` + indented children.
  - Lists of mappings (`- key: value`) and lists of scalars (`- value`).
  - Inline flow lists `[a, b, c]` (treated as comma-separated strings).
  - Block scalars `|` (literal preservation of newlines, leading-indent trim).
  - Comments starting with `#`.

NOT supported:
  - Anchors/aliases, tagged types, flow mappings `{a: b}`.
  - Multi-line folded `>`.
  - Quoted strings with escaped characters (plain quotes are stripped).

If you need any of those, switch to PyYAML and drop this module.
"""
import re


def _strip_comment(line):
    # A `#` inside a quoted string is not a comment. The dictionary never
    # uses inline quotes around # characters, so a plain strip is safe here.
    if "#" in line:
        # keep the `#` if it's inside a YAML list of single-char tokens like
        # `[a, b]` — but our file doesn't do that. Plain strip is fine.
        i = line.index("#")
        # Guard: if the # is inside a single-quoted string, don't strip.
        pre = line[:i]
        if pre.count("'") % 2 == 1 or pre.count('"') % 2 == 1:
            return line.rstrip()
        return line[:i].rstrip()
    return line.rstrip()


def _parse_scalar(raw):
    s = raw.strip()
    if s == "" or s == "~" or s == "null":
        return None
    if s == "true":
        return True
    if s == "false":
        return False
    if (s.startswith("'") and s.endswith("'")) or (s.startswith('"') and s.endswith('"')):
        return s[1:-1]
    if s.startswith("[") and s.endswith("]"):
        inner = s[1:-1].strip()
        if not inner:
            return []
        return [_parse_scalar(p) for p in _split_flow(inner)]
    # try int
    try:
        if re.fullmatch(r"-?\d+", s):
            return int(s)
    except Exception:
        pass
    return s


def _split_flow(s):
    parts = []
    depth = 0
    buf = []
    for ch in s:
        if ch == "," and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
        else:
            if ch in "[{":
                depth += 1
            elif ch in "]}":
                depth -= 1
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return parts


def _indent(line):
    m = re.match(r"^( *)", line)
    return len(m.group(1))


def load(text):
    """Parse our constrained YAML subset into nested dict/list structures."""
    raw_lines = text.splitlines()
    lines = []
    i = 0
    while i < len(raw_lines):
        ln = raw_lines[i]
        # Handle block scalar `|` — greedy capture of indented block.
        m = re.match(r"^( *)([A-Za-z0-9_\-]+):\s*\|\s*$", ln)
        if m:
            indent = len(m.group(1))
            key = m.group(2)
            block_lines = []
            j = i + 1
            block_indent = None
            while j < len(raw_lines):
                nxt = raw_lines[j]
                if nxt.strip() == "":
                    block_lines.append("")
                    j += 1
                    continue
                nxt_indent = _indent(nxt)
                if nxt_indent <= indent:
                    break
                if block_indent is None:
                    block_indent = nxt_indent
                block_lines.append(nxt[block_indent:])
                j += 1
            lines.append((indent, key, "\n".join(block_lines).rstrip() + "\n"))
            i = j
            continue
        # Strip comments on regular lines.
        stripped = _strip_comment(ln)
        if stripped.strip() == "":
            i += 1
            continue
        lines.append(("raw", stripped))
        i += 1

    # Now walk lines and build the tree.
    def parse_block(start, base_indent):
        out = None  # decide dict vs list on first child
        idx = start
        while idx < len(lines):
            item = lines[idx]
            if item[0] == "raw":
                line = item[1]
                ind = _indent(line)
                if ind < base_indent:
                    return out, idx
                content = line[ind:]
                if content.startswith("- "):
                    if out is None:
                        out = []
                    if not isinstance(out, list):
                        return out, idx
                    rest = content[2:]
                    # list item: either "- key: value" or "- scalar".
                    # YAML requires a space after the colon in a mapping, so
                    # `- path/with:line` stays a scalar. Split only on `: `
                    # (colon-space) or a trailing bare colon.
                    mapping_key_match = re.match(r"^([A-Za-z_][A-Za-z0-9_\-]*)(:\s.*|:\s*$)", rest)
                    if mapping_key_match:
                        key_part, _, val_part = rest.partition(":")
                        key = key_part.strip()
                        val_text = val_part.strip()
                        entry = {}
                        if val_text == "":
                            # nested block follows
                            idx += 1
                            child, idx = parse_block(idx, ind + 2)
                            entry[key] = child
                        else:
                            entry[key] = _parse_scalar(val_text)
                            idx += 1
                        # keep reading further "key: value" lines at same indent
                        while idx < len(lines):
                            item2 = lines[idx]
                            if item2[0] != "raw":
                                # Block-scalar tuple: (indent, key, text)
                                bi, bk, bv = item2
                                if bi != ind + 2:
                                    break
                                entry[bk] = bv
                                idx += 1
                                continue
                            nxt = item2[1]
                            if _indent(nxt) != ind + 2:
                                break
                            nxt_c = nxt[ind + 2:]
                            if nxt_c.startswith("- "):
                                break
                            if not re.match(r"^[A-Za-z_][A-Za-z0-9_\-]*(:\s|:\s*$)", nxt_c):
                                break
                            k2, _, v2 = nxt_c.partition(":")
                            k2 = k2.strip()
                            v2 = v2.strip()
                            if v2 == "":
                                idx += 1
                                sub, idx = parse_block(idx, ind + 4)
                                entry[k2] = sub
                            else:
                                entry[k2] = _parse_scalar(v2)
                                idx += 1
                        out.append(entry)
                    else:
                        out.append(_parse_scalar(rest))
                        idx += 1
                else:
                    # mapping
                    if out is None:
                        out = {}
                    if not isinstance(out, dict):
                        return out, idx
                    if ":" not in content:
                        idx += 1
                        continue
                    key, _, val = content.partition(":")
                    key = key.strip()
                    val = val.strip()
                    if val == "":
                        idx += 1
                        child, idx = parse_block(idx, ind + 2)
                        out[key] = child if child is not None else {}
                    else:
                        out[key] = _parse_scalar(val)
                        idx += 1
            else:
                # block scalar tuple: (indent, key, value)
                block_indent, block_key, block_value = item
                if block_indent < base_indent:
                    return out, idx
                if out is None:
                    out = {}
                out[block_key] = block_value
                idx += 1
        return out, idx

    tree, _ = parse_block(0, 0)
    return tree or {}


def load_file(path):
    with open(path, "r") as f:
        return load(f.read())
