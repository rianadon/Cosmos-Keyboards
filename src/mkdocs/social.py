"""
Customized Social Plugin for Cosmos.

Portions are modified from https://github.com/squidfunk/mkdocs-material/blob/master/src/plugins/social/plugin.py.
"""

from material.plugins.social.config import SocialConfig
from material.plugins.social.plugin import SocialPlugin
from PIL import Image, ImageDraw, ImageFont
import re
import os
from hashlib import md5

class CustomPlugin(SocialPlugin):

    def on_config(self, config):
        super().on_config(config)
        self._bg_promise = self._executor.submit(self._load_bg, config)
        self._small_logo_promise = self._executor.submit(self._load_resized_logo, config, 60)

    def _load_bg(self, config):
        return Image.open("docs/assets/social-card.png").convert("RGBA")

    def _load_resized_logo(self, config, width = 72):
        return super()._load_resized_logo(config, width)

    def _load_font(self, config):
        return os.path.join(os.path.dirname(config.docs_dir), 'static/urbanist.woff2')

    def _get_font(self, kind, size):
        font = ImageFont.truetype(self.font, size)
        font.set_variation_by_name(kind)
        return font

    # Create social cards
    def on_page_markdown(self, markdown, page, config, files):
        if not self.config.cards:
            return

        # Resolve image directory
        directory = self.config.cards_dir
        file, _ = os.path.splitext(page.file.src_path)

        # Resolve path of image
        path = "{}.png".format(os.path.join(
            config.site_dir,
            directory,
            file
        ))

        # Resolve path of image directory
        directory = os.path.dirname(path)
        if not os.path.isdir(directory):
            os.makedirs(directory)

        # Compute site name
        site_name = config.site_name

        # Compute page title and description
        title = page.meta.get("title", page.title)
        description = config.site_description or ""
        if "description" in page.meta:
            description = page.meta["description"]

        header = re.search(r"!\[.*\]\((.*)\)\s*{\s*.header\s*}", markdown)
        if header is not None:
            directory = os.path.dirname(page.file.src_path)
            header = os.path.normpath(os.path.join(config.docs_dir, directory, header.group(1)))

        # Check type of meta title - see https://t.ly/m1Us
        if not isinstance(title, str):
            log.error(
                f"Page meta title of page '{page.file.src_uri}' must be a "
                f"string, but is of type \"{type(title)}\"."
            )
            sys.exit(1)

        # Check type of meta description - see https://t.ly/m1Us
        if not isinstance(description, str):
            log.error(
                f"Page meta description of '{page.file.src_uri}' must be a "
                f"string, but is of type \"{type(description)}\"."
            )
            sys.exit(1)

        # Generate social card if not in cache
        hash = md5("".join([
            site_name,
            str(title),
            description
        ]).encode("utf-8"))
        file = os.path.join(self.cache, f"{hash.hexdigest()}.png")
        self._image_promises.append(self._executor.submit(
            self._cache_image,
            cache_path = file, dest_path = path,
            render_function = lambda: self._render_card(site_name, title, description, header)
        ))

        # Inject meta tags into page
        meta = page.meta.get("meta", [])
        page.meta["meta"] = meta + self._generate_meta(page, config)


    def _render_text(self, size, font, text, lmax, color, spacing = 0):
        width = size[0]
        lines, words = [], []

        # Remove remnant HTML tags
        text = re.sub(r"(<[^>]+>)", "", text)

        # Retrieve y-offset of textbox to correct for spacing
        yoffset = 0

        # Create drawing context and split text into lines
        for word in text.split(" "):
            combine = " ".join(words + [word])
            textbox = self._text_bounding_box(combine, font = font)
            yoffset = textbox[1]
            if not words or textbox[2] <= width:
                words.append(word)
            else:
                lines.append(words)
                words = [word]

        # Join words for each line and create image
        lines.append(words)
        lines = [" ".join(line) for line in lines]
        image = Image.new(mode = "RGBA", size = size)

        # Create drawing context and split text into lines
        context = ImageDraw.Draw(image)
        context.text(
            (0, spacing / 2 - yoffset), "\n".join(lines[:lmax]),
            font = font, fill = color, spacing = spacing - yoffset
        )

        # Return text image
        return image

    def _render_header(self, site_name, title, description, header_img):
        size = (1200, 630)
        gutter_size = 124
        corner_size = 20

        image = Image.new('RGBA', size, (255, 255, 255, 255))
        image.alpha_composite(Image.new('RGBA', (size[0], 26), (0, 231, 165, 255)), (0, size[1] - 26))

        header = Image.open(header_img).convert("RGBA")
        height = round(header.height / header.width * (size[0] - gutter_size))
        corner_size = round(corner_size * header.width / (size[0] - gutter_size))

        # Draw header image
        circle = Image.new('L', (corner_size * 2, corner_size * 2), 0)
        draw = ImageDraw.Draw(circle)
        draw.ellipse((0, 0, corner_size * 2 - 1, corner_size * 2 - 1), fill=255)
        alpha = header.getchannel(3)
        crop = (0, 0, corner_size, corner_size)
        alpha.paste(circle.crop(crop), (0, 0), alpha.crop(crop))
        header.putalpha(alpha)
        image.alpha_composite(
            header.resize((size[0] - gutter_size, height)), (gutter_size, size[1] - height - 26)
        )

        # Render page title
        font = self._get_font("SemiBold", 70)
        image.alpha_composite(
            self._render_text((size[0] - gutter_size - 12, size[1] - height - 60), font, title, 2, self.color["text"], 30),
            (gutter_size + 6, 34)
        )

        # Render logo
        logo = self._small_logo_promise.result()
        image.alpha_composite(logo, ((gutter_size - logo.width)//2, 46))

        # Render site title
        font = self._get_font("Regular", 30)
        title = "Cosmos KB Generator"
        image.alpha_composite(
            self._render_text((size[1] - 160, 30), font, title, 1, "#52526B").transpose(Image.ROTATE_90),
            ((gutter_size-30)//2, 70)
        )

        return image

    # Render social card
    def _render_card(self, site_name, title, description, header_img):
        if header_img is not None:
            return self._render_header(site_name, title, description, header_img)
        scale = lambda x: int(round(x*24/28))

        # Render background and logo
        image = self._bg_promise.result().copy()
        image.alpha_composite(
            self._resized_logo_promise.result(),
            (68, 64 - 8)
        )

        # Render site name
        font = self._get_font("SemiBold", scale(36))
        image.alpha_composite(
            self._render_text((826, 48), font, site_name, 1, self.color["text"], 20),
            (172, 72)
        )

        # Render page title
        font = self._get_font("SemiBold", scale(92))
        image.alpha_composite(
            self._render_text((826, 328), font, title, 3, self.color["text"], 30),
            (64, 172)
        )

        # Render page description
        color = self.color["text"]
        font = self._get_font("Regular", scale(28))
        image.alpha_composite(
            self._render_text((640, 80), font, description, 2, "#52526B", 14),
            (64 + 4, 512 + 24)
        )
        self.color["text"] = color

        # Return social card image
        return image

plugin = CustomPlugin()
config = SocialConfig()
config.set_defaults()
config.cache_dir = "target/cards"
config.cards_layout_options["color"] = "#000"
plugin.config = config

def on_config(config):
    plugin.on_config(config)

def on_page_markdown(markdown, page, config, files):
    return plugin.on_page_markdown(markdown, page, config, files)

def on_post_build(config):
    return plugin.on_post_build(config)
