import { Baloo_Da_2, Hind_Siliguri, Inter, Manrope, Newsreader, Nunito_Sans, Space_Grotesk } from "next/font/google";
import localFont from "next/font/local";

// Every face the three themes use. Bangla is always Kalpurush; each theme has its own faces for
// Latin text. The Latin faces aren't preloaded: a page only downloads the ones its theme sets, so
// a Mist site never fetches Ink's serif and the other way round.
// (next/font reads these options at build time, so each call spells them out in full.)

/**
 * Kalpurush (Avro Font Development Project, SIL Open Font License 1.1: src/fonts/Kalpurush-OFL.txt),
 * the original file, unmodified. It answers only for Bangla characters (the Bengali block, the
 * দাঁড়ি, the joiners that steer conjuncts, the dotted circle), so it can stand first in a font stack
 * and the theme's own face still draws Latin text. It has one weight; bold Bangla is drawn bolder
 * by the browser. Preloaded: nearly every page has Bangla on it. No Arial stand-in is generated,
 * since it would answer for Latin text ahead of the theme's face.
 */
const kalpurush = localFont({
  src: "../fonts/Kalpurush.ttf",
  weight: "400",
  style: "normal",
  variable: "--ff-kalpurush",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0964-0965, U+0980-09FE, U+200C-200D, U+25CC" }],
});
const inter = Inter({ subsets: ["latin"], variable: "--ff-inter", display: "swap", preload: false });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--ff-newsreader", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], variable: "--ff-manrope", display: "swap", preload: false });
const balooDa = Baloo_Da_2({ subsets: ["latin"], variable: "--ff-baloo", display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--ff-nunito", display: "swap", preload: false });
// The question bank (the QBank design): Hind Siliguri for its Latin text, Space Grotesk for its
// headings and numbers; Kalpurush for Bangla, as everywhere.
const hind = Hind_Siliguri({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-hind",
  display: "swap",
  preload: false,
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--ff-grotesk",
  display: "swap",
  preload: false,
});

/** Class names that define every font variable; set once on <html>. */
export const fontVariables = [kalpurush, inter, newsreader, manrope, balooDa, nunitoSans, hind, spaceGrotesk]
  .map((font) => font.variable)
  .join(" ");
