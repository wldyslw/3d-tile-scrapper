import * as fs from "fs";
import { mkdir, writeFile, readFile, open } from "fs/promises";
import { Readable } from "stream";
import { finished } from "stream/promises";
import path from "path";

const assesId = 1; // asset id goes here
const accessToken = ""; // Cesium ION account access token goes here

const endpointBase = "https://assets.ion.cesium.com/354759/";
const headers = new Headers();
const errorsPath = "./errors.txt";

/**
 *
 * @param {Object} tile
 * @param {Function} cb
 */
function traverseChildren(tile, cb) {
  cb(tile.content.uri);

  if (tile.children) {
    for (let child of tile.children) {
      cb(child.content.uri);
      if (child.children) {
        traverseChildren(child, cb);
      }
    }
  }
}

/**
 * @param {string} endpoint
 * @param {Response} response
 */
async function download(endpoint, response) {
  const folder = endpoint.split("/").slice(0, -1).join("/");
  const folderPath = path.resolve("./downloads/", folder);
  if (!fs.existsSync(folderPath)) {
    await mkdir(folderPath, { recursive: true });
  }

  const destination = path.resolve("./downloads/", endpoint);
  if (!fs.existsSync(destination)) {
    const fileStream = fs.createWriteStream(destination, { flags: "wx" });
    await finished(Readable.fromWeb(response.body).pipe(fileStream));
  }
}

/**
 * @param {string} endpoint
 * @param {string} content
 */
async function writeJson(endpoint, content) {
  const folder = endpoint.split("/").slice(0, -1).join("/");
  const folderPath = path.resolve("./downloads", folder);
  if (!fs.existsSync(folderPath)) {
    await mkdir(folderPath, { recursive: true });
  }
  const destination = path.resolve("./downloads", endpoint);
  if (!fs.existsSync(destination)) {
    await writeFile(destination, content);
  }
}

/**
 * @param {string} endpoint
 * @param {string} basePath
 */
async function scrap(endpoint, basePath = "") {
  if (!endpoint) {
    return;
  }

  const isJson = endpoint.includes(".json");
  const fullPath = basePath + endpoint;

  basePath += endpoint.split("/").slice(0, -1).join("/");
  if (basePath !== "" && !basePath.endsWith("/")) {
    basePath += "/";
  }
  console.log(fullPath);

  const fsPath = path.resolve("./downloads", fullPath);
  if (fs.existsSync(fsPath)) {
    if (isJson) {
      const uris = [];
      const file = await readFile(fsPath, { encoding: "utf-8" });
      const json = JSON.parse(file);

      traverseChildren(json.root, (uri) => {
        uris.push(uri);
      });

      for (let uri of uris) {
        await scrap(uri, basePath);
      }
    }
  } else {
    let response;

    try {
      response = await fetch(endpointBase + fullPath, {
        method: "GET",
        headers,
      });
      await writeFile("./files.txt", `${fullPath}\n`, { flag: "a" });
    } catch (e) {
      console.log(
        `Fetch for ${fullPath} failed, path appended to ${errorsPath}`
      );
      await writeFile(errorsPath, `${fullPath}\n`, { flag: "a" });
    }

    if (response && response.status === 200) {
      if (isJson) {
        const uris = [];
        const json = await response.json();

        await writeJson(fullPath, JSON.stringify(json));

        traverseChildren(json.root, (uri) => {
          uris.push(uri);
        });

        for (let uri of uris) {
          await scrap(uri, basePath);
        }
      } else {
        await download(fullPath, response);
      }
    }
  }
}

async function rescrap() {
  const errorsFile = await open(errorsPath);
  for await (let line of errorsFile.readLines()) {
    let response;
    try {
      response = await fetch(endpointBase + line, {
        method: "GET",
        headers,
      });
    } catch (error) {
      console.log(error);
    }
    if (response && response.status === 200) {
      const isJson = line.includes(".json");

      if (isJson) {
        await scrap(line);
      } else {
        await download(line, response);
      }
    }
  }
}

async function main() {
  const entryUrl = new URL(
    `https://api.cesium.com/v1/assets/${assesId}/endpoint`
  );
  entryUrl.searchParams.append("access_token", accessToken);

  const response = await fetch(entryUrl);
  const json = await response.json();
  headers.append("Authorization", `Bearer ${json.accessToken}`);

  console.log("Token retrieved, scrapping...\n");
  await scrap("tileset.json");

  console.log("Rescrapping files with errors...");
  await rescrap();
  console.log("Done!");
}

main();
