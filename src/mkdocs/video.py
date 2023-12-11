"""
mkdocs video support

adapted from https://github.com/soulless-viewer/mkdocs-video/
adds extra features to use the compressed videos
"""

import mkdocs
import lxml.html
import os

MARK = "type:video"
VIDEO_CONTROLS = True
VIDEO_AUTOPLAY = False
CSS_STYLE = { "width": "100%" }

build = "MKDOCS_BUILD" in os.environ

def on_page_content(html, page, config, files):
    content = lxml.html.fromstring(html)
    tags = content.xpath(f'//img[@alt="{MARK}" and @src]')
    for tag in tags:
        if not tag.attrib.get("src"):
            continue
        tag.getparent().replace(tag, create_repl_tag(tag))
    return lxml.html.tostring(content, encoding="unicode")

def is_video(fname):
    return fname.endswith('.mp4')

def create_repl_tag(tag):
    """
    Сreate a replacement tag with the specified source and style.

    return: str
    """

    is_video = not tag.attrib["src"].startswith('http')
    repl_tag = lxml.html.Element("video" if is_video else "iframe")

    # Basic config if global is disabled
    if is_video:
        for ext in ["webm", "mp4", ]:
            repl_subtag = lxml.html.Element("source")
            src = tag.attrib["src"]
            if build:
                src = src.replace('assets', 'assets/target')
                src = os.path.splitext(src)[0]+'.'+ext
            elif os.path.splitext(src)[1] != '.'+ext:
                continue
            repl_subtag.set("src", src)
            repl_subtag.set("type", f"video/{ext}")
            repl_tag.append(repl_subtag)
    else:
        repl_tag.set("src", tag.attrib["src"])

    # Extended config if global is enabled
    if "disable-global-config" not in tag.attrib:
        css_style = ";".join(
            [f"{k}:{v}" for k, v in CSS_STYLE.items()]
        )
        repl_tag.set("style", css_style)

        if is_video:
            if VIDEO_CONTROLS:
                repl_tag.set("controls")
            if VIDEO_AUTOPLAY:
                repl_tag.set("autoplay")
        else:
            repl_tag.set("frameborder", "0")
            repl_tag.set("allowfullscreen")
    else:
        tag.attrib.pop("disable-global-config")

    # Duplicate everything from original tag (except 2)
    for attr, val in tag.attrib.items():
        if "src" != attr:
            repl_tag.set(attr, val if val else None)

    div = lxml.html.Element("div")
    div.set("class", "video-container")
    div.append(repl_tag)

    return div
