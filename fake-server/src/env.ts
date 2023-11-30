import { envsafe, str } from "envsafe";
import { config } from "dotenv";

config();

export const env = envsafe({
  MODPACK_LOCATION: str({
    desc: "Location to the root folder for the mod pack",
  }),
  DATABASE_LOCATION: str({
    default: "fake.sqlite",
    desc: "File location for the sqlite database",
  }),
  MINECRAFT_VERSION: str({
    desc: "The base version of Minecraft your modpack runs on",
    example: "1.19.2",
  }),
});
