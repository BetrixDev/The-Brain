type DbOptions<TValue extends any, TLiteral extends boolean> = {
  onChange?: (
    values: TLiteral extends true ? TValue : Record<string, TValue>
  ) => void;
  defaultValue?: TLiteral extends true ? TValue : Record<string, TValue>;
};

export function initDB<TValue extends any, TLiteral extends boolean = false>(
  dbName: string,
  { onChange, defaultValue }: DbOptions<TValue, TLiteral>
) {
  const fileName = `db/${dbName}.json`;

  if (!fs.exists(fileName)) {
    const [file] = fs.open(fileName, "w");

    if (!file) {
      throw new Error("unable to create intial db file");
    }

    file.write(textutils.serializeJSON(defaultValue ?? {}));

    file.close();
  }

  return {
    getAll: () => {
      const [file] = fs.open(fileName, "r");

      if (!file) {
        throw new Error("unable to read db file");
      }

      const json = textutils.unserializeJSON(file.readAll());

      file.close();

      return json as TLiteral extends true ? TValue : Record<string, TValue>;
    },
    get: <
      TGetKey extends TLiteral extends true ? keyof TValue : string,
      TGetValue extends TLiteral extends true
        ? TValue extends Record<string, any>
          ? TValue[TGetKey]
          : TValue
        : TValue,
    >(
      key: TGetKey
    ) => {
      const [file] = fs.open(fileName, "r");

      if (!file) {
        throw new Error("unable to read db file");
      }

      const json = textutils.unserializeJSON(file.readAll());

      file.close();

      return json[key] as TGetValue;
    },
    set: <
      TSetKey extends TLiteral extends true ? keyof TValue : string,
      TSetValue extends TLiteral extends true
        ? TValue extends Record<string, any>
          ? TValue[TSetKey]
          : TValue
        : TValue,
    >(
      key: TSetKey,
      value: TSetValue
    ) => {
      let [file] = fs.open(fileName, "r");

      if (!file) {
        throw new Error("unable to read db file");
      }

      const json = textutils.unserializeJSON(file.readAll());

      json[key] = value;

      const [newFile] = fs.open(fileName, "w");

      if (!newFile) {
        throw new Error("unable to read db file");
      }

      newFile.write(textutils.serializeJSON(json));
      newFile.close();

      if (onChange !== undefined) {
        onChange(json);
      }
    },
  };
}
