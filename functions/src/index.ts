import { onRequest } from "firebase-functions/v2/https";
const fetch = require("node-fetch");
import * as logger from "firebase-functions/logger";

export const helloWorld = onRequest(async (request, response) => {
  const url = "https://api.themoviedb.org/3/authentication";
  const res = await fetch(url, {
    headers: {
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3YmM3NjhkY2YzMmZmZTZmMTMzZTVkMDhlMDg5MTgyNiIsIm5iZiI6MTcyMDI2NDc2NC4xMDAyMzIsInN1YiI6IjY2ODkyNjY2MjBlODcyZGE2NmEwNjIxMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.u01Mjer3_VU9NLR867c8HFpWarF5BZ2XYjDPbBB2TWc",
      accept: "application/json",
    },
  });

  const data = await res.json(); // Convertendo a resposta para JSON
  logger.info(data, { structuredData: true });

  response.send(data); // Enviando a resposta JSON ao cliente
});
