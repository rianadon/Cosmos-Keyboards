"""
mkdocs compressed image support
"""

import mkdocs
import lxml.html
import os
from copy import deepcopy

build = "MKDOCS_BUILD" in os.environ

def on_page_content(html, page, config, files):
    content = lxml.html.fromstring(html)
    tags = content.xpath(f'//img[@src]')
    for tag in tags:
        src = tag.attrib.get("src")
        if not src:
            continue
        if build:
            if src.endswith('.png') and not src.startswith('http'):
                newtag = create_repl_tag(tag)
                tag.getparent().replace(tag, newtag)
                tag = newtag
        if not src.startswith('http'):
            tag.getparent().replace(tag, create_lightbox_tag(tag))
    return lxml.html.tostring(content, encoding="unicode")

def create_repl_tag(tag):
    """
    Сreate a replacement tag with the specified source and style.

    return: str
    """

    repl_tag = lxml.html.Element("picture")

    # Basic config if global is disabled
    base = tag.attrib["src"].replace('assets', 'assets/target').replace('target/target', 'target')
    for ext in ["avif", "webp"]:
        repl_subtag = lxml.html.Element("source")
        repl_subtag.set("srcset", os.path.splitext(base)[0]+'.'+ext)
        repl_subtag.set("type", f"image/{ext}")
        repl_tag.append(repl_subtag)

    repl_img = lxml.html.Element("img")
    # Duplicate everything from original tag (except 2)
    for attr, val in tag.attrib.items():
        if "src" != attr:
            repl_img.set(attr, val if val else None)

    repl_img.set("src", os.path.splitext(base)[0]+'.jpg')
    repl_tag.append(repl_img)

    return repl_tag

def create_lightbox_tag(tag):
    new_node = lxml.html.Element('a')
    new_node.set("class", "lightbox")
    if 'src' in tag.attrib:
        new_node.set("href", tag.attrib["src"])
    else:
        img = tag.xpath(f'img[@src]')[0]
        new_node.set("href", img.attrib["src"])

    new_node.append(deepcopy(tag))
    return new_node
