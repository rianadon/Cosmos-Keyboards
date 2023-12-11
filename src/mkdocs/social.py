"""
Customized Social Plugin for Cosmos.

Portions are modified from https://github.com/squidfunk/mkdocs-material/blob/master/src/plugins/social/plugin.py.
"""

from material.plugins.social.config import SocialConfig
from material.plugins.social.plugin import SocialPlugin
from PIL import Image, ImageDraw, ImageFont
import re

class CustomPlugin(SocialPlugin):

    def on_config(self, config):
        super().on_config(config)
        self._bg_promise = self._executor.submit(self._load_bg, config)

    def _load_bg(self, config):
        return Image.open("docs/assets/social-card.png").convert("RGBA")

    def _load_resized_logo(self, config, width = 72):
        return super()._load_resized_logo(config, width)


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

    # Render social card
    def _render_card(self, site_name, title, description):
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
config.cards_layout_options["font_family"] = "Poppins"
plugin.config = config

def on_config(config):
    plugin.on_config(config)

def on_page_markdown(markdown, page, config, files):
    return plugin.on_page_markdown(markdown, page, config, files)

def on_post_build(config):
    return plugin.on_post_build(config)
