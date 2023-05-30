# 3D Tile Scrapper

A simple Node.js script to scrap your 3D tiles, specifically, from Cesium ION.

**Please note, that from legal standpoint you have to own resources which you want scrap!**

## Startup

Simply, as:

```bash
pnpm scrap
```

If some file related to tileset already exists in `downloads` folder (only file name is taken to account), script will skip fetching it from source and will read file insted, if needed. This way, you can safely terminate script at any time without any network overhead!
