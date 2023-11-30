import { envsafe, str } from "envsafe";

export const env = envsafe({
  NODE_ENV: str({
    default: "production",
  }),
  DATABASE_LOCATION: str({
    default: "brain.sqlite",
    desc: "File location for the sqlite database",
  }),
  MODPACK_LOCATION: str({
    desc: "Location to the root folder for the mod pack",
  }),
  MINECRAFT_VERSION: str({
    desc: "The base version of Minecraft your modpack runs on",
    example: "1.19.2",
  }),
});
