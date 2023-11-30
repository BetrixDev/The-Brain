import path from "path";
import { env } from "../env";
import { existsSync, readdirSync } from "fs";
import { db, items } from "../db";
import AdmZip from "adm-zip";
import { z } from "zod";
import toml from "toml";

// https://docs.minecraftforge.net/en/1.20.x/gettingstarted/modfiles/
const modTomlSchema = z
  .object({
    mods: z
      .array(
        z.object({
          logoFile: z.string().optional(),
          modId: z.string(),
          displayName: z.string().optional(),
          description: z.string().default("MISSING DESCRIPTION"),
        })
      )
      .transform((ctx) => ctx[0]),
  })
  .transform((ctx) => ctx.mods);

const modTomlPath = "META-INF/mods.toml";
const itemLangRegex = /(?<type>block|item)\.(?<modId>.*)\.(?<itemId>.*)/;
const altItemLangRegex = /(?<modId>.*)\.(?<type>block|item)\.(?<itemId>.*)/;

const langGroupsSchema = z.object({
  type: z.literal("item").or(z.literal("block")),
  modId: z.string(),
  itemId: z.string(),
});

const modFolderPath = path.join(env.MODPACK_LOCATION, "mods");
const dataPath = path.join(__dirname, "..", "..", ".data");
const vanillaJarPath = path.join(
  dataPath,
  `vanilla-${env.MINECRAFT_VERSION}.jar`
);

async function initData() {
  if (!existsSync(env.MODPACK_LOCATION)) {
    throw new Error(`${env.MODPACK_LOCATION} does not exist`);
  }

  if (!existsSync(modFolderPath)) {
    throw new Error(
      `There is no mods folder present under ${env.MODPACK_LOCATION}`
    );
  }

  const modPaths = [
    vanillaJarPath,
    ...readdirSync(modFolderPath).map((modPath) =>
      path.join(modFolderPath, modPath)
    ),
  ];

  await db.delete(items).execute();

  const itemsInsert: (typeof items.$inferInsert)[] = [];

  for (const modPath of modPaths) {
    console.log(modPath);
    const zip = new AdmZip(modPath);

    let modName: string | undefined;

    if (modPath === vanillaJarPath) {
      modName = "minecraft";
    } else {
      const modTomlEntry = zip.getEntry(modTomlPath);

      if (modTomlEntry === null) continue;

      const modConfigParsed = modTomlSchema.safeParse(
        toml.parse(modTomlEntry.getData().toString()!)
      );

      if (!modConfigParsed.success) continue;

      const modConfig = modConfigParsed.data;

      modName = modConfig.modId;
    }

    const langFile = zip.getEntries().find((entry) => {
      return entry.entryName.match(
        new RegExp(`assets\/${modName}\/lang\/en_us\.json`)
      );
    });

    if (langFile === undefined) continue;

    const lang: Record<string, string> = JSON.parse(
      langFile.getData().toString()
    );

    Object.keys(lang).forEach((key) => {
      if (key.split(".").length !== 3) return;

      let match = key.match(itemLangRegex);

      if (match === null) {
        match = key.match(altItemLangRegex);

        if (match === null) return;
      }

      const groups = langGroupsSchema.safeParse(match.groups);

      if (!groups.success) return;

      itemsInsert.push({
        id: groups.data.itemId,
        modId: groups.data.modId,
      });
    });
  }

  await db.transaction(async (tx) => {
    for (let i = 0; i < itemsInsert.length / 500; i++) {
      const slice = itemsInsert.slice(500 * i, (i + 1) * 500);

      await tx.insert(items).values(slice).onConflictDoNothing().execute();
    }
  });
}

initData()
  .then(() => {
    console.log("Succesfully initialized the fake data server");
  })
  .catch((e) => console.log(e));
