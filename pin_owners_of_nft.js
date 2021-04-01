const config = require("./config");
const getHolders = require("./lib/get.holders");
const filterUnique = require("./lib/filter.unique");
const {
  getArtisticOutputForAddress,
  getCollectionForAddress,
} = require("./lib/conseilUtil");
const getBlockedObj = require("./lib/get.blocked.obj");
const getBlockedTz = require("./lib/get.blocked.tz");
const getIPFS = require("./lib/get.IPFS");
const objktSanitize = require("./lib/objkt.sanitize");
const pin = require("./lib/ipfs.pin");

const PIN_SERVICE_OBJKT_ID = 1181;
const baseURL = `https://www.hicetnunc.xyz/objkt/`;

const pin_wallet_creations_and_collection = async (tz, oblock, wblock) => {
  console.log("Fetching Collection...");
  const collection = await getCollectionForAddress(tz);
  console.log("Fetching Creations...");
  const creations = await getArtisticOutputForAddress(tz);
  console.log("Get all metadata...");

  // May need to throttle this when the lists get too long.
  const arr = await Promise.all(
    [...collection, ...creations].map(async (e) => {
      e.token_info = await getIPFS(e.ipfsHash);
      if (e.piece != undefined) {
        e.token_id = parseInt(e.piece);
      } else {
        e.token_id = parseInt(e.objectId);
      }
      return e;
    })
  );

  const sanitizedList = objktSanitize(arr).filter(filterUnique);
  const filtered = sanitizedList.filter((i) =>
      !oblock.includes(i.token_id) && !wblock.includes(i.token_info.creators[0])
  );

  const contentHashes = filtered
    .map((i) => i.token_info.artifactUri.replace("ipfs://", ""))
    .filter(filterUnique);
  const thumbnailHashes = filtered
    .map((i) => i.token_info.thumbnailUri.replace("ipfs://", ""))
    .filter(filterUnique);
  console.log(`⚡ pinning ${filtered.length} meta hashes`);
  for (let i = 0; i < filtered.length; i++) {
    await pin(filtered[i].ipfsHash);
  }
  console.log(`⚡ pinning ${contentHashes.length} content hashes`);
  for (let i = 0; i < contentHashes.length; i++) {
    await pin(contentHashes[i]);
  }
  console.log(`⚡ pinning ${thumbnailHashes.length} thumb hashes`);
  for (let i = 0; i < thumbnailHashes.length; i++) {
    await pin(thumbnailHashes[i]);
  }

  const blocked = sanitizedList
    .filter(
      (i) =>
        oblock.includes(i.token_id) || wblock.includes(i.token_info.creators[0])
    )
    .filter(filterUnique);
  const blockedContentHashes = blocked
    .map((i) => i.token_info.artifactUri.replace("ipfs://", ""))
    .filter(filterUnique);
  const blockedThumbnailHashes = blocked
    .map((i) => i.token_info.thumbnailUri.replace("ipfs://", ""))
    .filter(filterUnique);

  console.log(`⚡ unpinning ${blocked.length} meta hashes`);
  for (let i = 0; i < blocked.length; i++) {
    await pin(blocked[i].ipfsHash, "rm");
  }
  console.log(`⚡ unpinning ${blockedContentHashes.length} content hashes`);
  for (let i = 0; i < blockedContentHashes.length; i++) {
    await pin(blockedContentHashes[i], "rm");
  }
  console.log(`⚡ unpinning ${blockedThumbnailHashes.length} thumb hashes`);
  for (let i = 0; i < blockedThumbnailHashes.length; i++) {
    await pin(blockedThumbnailHashes[i], "rm");
  }
}

(async () => {
  const oblock = await getBlockedObj();
  const wblock = await getBlockedTz();
  const holders = Object.keys(await getHolders(PIN_SERVICE_OBJKT_ID))
                  .filter((s) => s.startsWith("tz"));
  for(i in holders){
    console.log("Pinning: ", holders[i]);
    await pin_wallet_creations_and_collection(holders[i], oblock, wblock);
  }
})();

