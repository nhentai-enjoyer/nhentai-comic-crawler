import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { saveImage } from "./download";

import type { archieHistory } from "../localSave/a7history";

import ora from "ora";
import axios from "axios";
import chalk from "chalk";

export const DefaultHeader = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
} as const;

//User-Agent:
//Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0

enum ImageFormat {
  Png = "p",
  Jpg = "j",
  webp = "w",
  Gif = "g",
}

enum TagType {
  Tag = "tag",
  Category = "category",
  Language = "language",
  Artist = "artist",
  Parody = "parody",
  Character = "character",
}

type Image = {
  t: ImageFormat;
  w: number;
  h: number;
};

type Tag = {
  id: number;
  type: TagType;
  name: string;
  url: string;
  count: number;
};

export class Doujin {
  id: number;
  media_id: string;
  title: {
    english: string;
    japanese: string;
    pretty: string;
  };
  images: {
    pages: Image[];
    cover: Image;
    thumbnail: Image;
  };
  /** 掃描的人 */
  scanlator: string;
  upload_date: number;
  tags: Tag[];
  num_pages: number;
  num_favorites: number;

  constructor(data: Record<string, any>) {
    this.id = data["id"];
    this.media_id = data["media_id"];
    this.title = data["title"];
    this.images = data["images"];
    this.scanlator = data["scanlator"];
    this.upload_date = data["upload_date"];
    this.tags = data["tags"];
    this.num_pages = data["num_pages"];
    this.num_favorites = data["num_favorites"];
  }

  async download(
    targetPath: string,
    counter: string = "👾",
    history: boolean = true
  ) {
    const folderPath = join(
      targetPath,
      `[${this.id}] ${this.title.pretty}`
    ).replace(/[/<>:."\|?*]/g, "_");

    mkdirSync(folderPath, { recursive: true });

    const spinner = ora(
      `${counter}. ${chalk.cyanBright(
        `[0/${this.num_pages}]`
      )} ${chalk.yellowBright(this.id)} ${this.title.pretty}`
    ).start();

    let error: { page: number; error: any }[] = [];

    for (const index in this.images.pages) {
      spinner.text = `${counter}. ${chalk.cyanBright(
        `[${+index + 1}/${this.num_pages}]`
      )} ${chalk.yellowBright(this.id)} ${this.title.pretty}`;
      const page = this.images.pages[index];
      const extension =
        page.t == ImageFormat.Png
          ? "png"
          : page.t == ImageFormat.Jpg
            ? "jpg"
            : page.t == ImageFormat.webp ? "t.webp"
              : "gif";

      let url = `https://i3.nhentai.net/galleries/${this.media_id}/${+index + 1
        }.${extension}`;
      if (extension == "t.webp") {
        url = `https://t.nhentai.net/galleries/${this.media_id}/${+index + 1
          }${extension}`;
      }

      const filename = `${+index + 1}.${extension}`;
      const file = join(folderPath, filename);
      if (existsSync(file)) continue;

      await saveImage(url, file).catch((e) => {
        error.push({
          page: +index + 1,
          error: e,
        });
      });
    }

    if (error.length) {
      spinner.warn();
      for (const e of error) {
        console.error(
          chalk.redBright(`\t下載第 ${e.page} 頁時發生錯誤：${e.error}`)
        );
      }
    } else {
      spinner.succeed();
    }

    //write histroy file
    if (!history) return;

    const localData: archieHistory = JSON.parse(
      readFileSync("./res/history.json", "utf-8")
    );
    localData["list-count"]++;
    localData["lastDate"] = getToday();
    localData.list.push({
      title: this.title.pretty,
      id: this.id.toString(),
      date: getToday(),
    });

    writeFileSync("./res/history.json", JSON.stringify(localData, null, 2));
  }
}

/**
 * Fetches and parses information from nhentai.net for a given comic ID.
 *
 * @param {string} id - The nhentai comic ID.
 * @returns {Promise<Doujin>} - An object containing doujin information.
 */
export async function doujinAPI(id: string | number): Promise<Doujin> {
  const url = `https://nhentai.net/api/gallery/${id}`;

  const response = await axios.get<Doujin>(url, {
    headers: {
      ...DefaultHeader,
    },
  });
  return new Doujin(response.data);
}

function getToday() {
  const date = new Date();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return m.toString() + d.toString();
}
