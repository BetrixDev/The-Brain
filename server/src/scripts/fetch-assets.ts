import { existsSync, readdirSync, writeFileSync } from "fs";
import { env } from "src/env";
import path from "path";
import AdmZip from "adm-zip";
import { z } from "zod";
import toml from "toml";
import { db, itemAssets, modAssets } from "$/db";

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

export async function fetchAssets() {
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

  try {
    await db.transaction(async (tx) => {
      await tx.delete(itemAssets).execute();
      await tx.delete(modAssets).execute();
    });
  } catch (e) {
    console.log(e);
  }

  const itemAssetsInsert: (typeof itemAssets.$inferInsert)[] = [];
  const modAssetsInsert: (typeof modAssets.$inferInsert)[] = [];

  for (const modPath of modPaths) {
    const zip = new AdmZip(modPath);

    let modData: typeof modAssets.$inferInsert;

    if (modPath === vanillaJarPath) {
      modData = {
        modId: "minecraft",
        jarFile: modPath,
        displayName: "Minecraft",
      };
    } else {
      const modTomlEntry = zip.getEntry(modTomlPath);

      if (modTomlEntry === null) continue;

      const modConfigParsed = modTomlSchema.safeParse(
        toml.parse(modTomlEntry.getData().toString()!)
      );

      if (!modConfigParsed.success) continue;

      const modConfig = modConfigParsed.data;

      let modIcon: string | undefined;

      if (modConfig.logoFile !== undefined) {
        const fileBuffer = zip.getEntry(modConfig.logoFile);

        if (fileBuffer !== null) {
          modIcon = fileBuffer.getData().toString("base64");
        }
      } else if (zip.getEntry("icon.png") !== null) {
        const fileBuffer = zip.getEntry("icon.png")!;

        modIcon = fileBuffer.getData().toString("base64");
      } else if (zip.getEntry("pack.png") !== null) {
        const fileBuffer = zip.getEntry("pack.png")!;

        modIcon = fileBuffer.getData().toString("base64");
      } else if (zip.getEntry("logo.png") !== null) {
        const fileBuffer = zip.getEntry("logo.png")!;

        modIcon = fileBuffer.getData().toString("base64");
      }

      modData = {
        modId: modConfig.modId,
        displayName: modConfig.displayName,
        texture64: modIcon,
        jarFile: modPath,
      };
    }

    modAssetsInsert.push(modData);

    const items: (typeof itemAssets.$inferInsert)[] = [];

    const langFile = zip.getEntries().find((entry) => {
      return entry.entryName.match(
        new RegExp(`assets\/${modData.modId}\/lang\/en_us\.json`)
      );
    });

    if (langFile === undefined) continue;

    const lang: Record<string, string> = JSON.parse(
      langFile.getData().toString()
    );

    Object.entries(lang).forEach(([key, displayName]) => {
      if (key.split(".").length !== 3) return;

      let match = key.match(itemLangRegex);

      if (match === null) {
        match = key.match(altItemLangRegex);

        if (match === null) return;
      }

      const groups = langGroupsSchema.safeParse(match.groups);

      if (!groups.success) return;

      items.push({
        displayName,
        itemId: groups.data.itemId,
        modId: modData.modId,
      });
    });

    if (items.length > 0) {
      itemAssetsInsert.push(...items);
    }
  }

  await db
    .insert(modAssets)
    .values(modAssetsInsert)
    .onConflictDoNothing()
    .execute();

  await db.transaction(async (tx) => {
    for (let i = 0; i < itemAssetsInsert.length / 500; i++) {
      const slice = itemAssetsInsert.slice(500 * i, (i + 1) * 500);

      await tx.insert(itemAssets).values(slice).onConflictDoNothing().execute();
    }
  });
}

fetchAssets()
  .then(() => {
    console.log("Succesfully fetched required assets");
  })
  .catch((e) => console.log(e));
