import {
  Anek_Bangla,
  Baloo_Da_2,
  Hind_Siliguri,
  Inter,
  Manrope,
  Newsreader,
  Noto_Sans_Bengali,
  Noto_Serif_Bengali,
  Nunito_Sans,
} from "next/font/google";

// Every face the three themes use. None is preloaded: a page only downloads the faces its theme
// actually sets, so a Mist site never fetches Ink's serif and the other way round.
// (next/font reads these options at build time, so each call spells them out in full.)

const inter = Inter({ subsets: ["latin"], variable: "--ff-inter", display: "swap", preload: false });
const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-hind",
  display: "swap",
  preload: false,
});
const newsreader = Newsreader({ subsets: ["latin"], variable: "--ff-newsreader", display: "swap", preload: false });
const notoSerifBengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  variable: "--ff-noto-serif-bn",
  display: "swap",
  preload: false,
});
const manrope = Manrope({ subsets: ["latin"], variable: "--ff-manrope", display: "swap", preload: false });
const anekBangla = Anek_Bangla({ subsets: ["bengali", "latin"], variable: "--ff-anek", display: "swap", preload: false });
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--ff-noto-sans-bn",
  display: "swap",
  preload: false,
});
const balooDa = Baloo_Da_2({ subsets: ["bengali", "latin"], variable: "--ff-baloo", display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--ff-nunito", display: "swap", preload: false });

/** Class names that define every font variable; set once on <html>. */
export const fontVariables = [
  inter,
  hind,
  newsreader,
  notoSerifBengali,
  manrope,
  anekBangla,
  notoSansBengali,
  balooDa,
  nunitoSans,
]
  .map((font) => font.variable)
  .join(" ");
