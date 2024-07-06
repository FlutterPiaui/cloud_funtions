/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import { logger } from "firebase-functions/v1";
import { onRequest, Request } from "firebase-functions/v2/https";

import fetch from "node-fetch";

const express = require("express");

const app = express();

const baseUrl = "https://api.themoviedb.org/3";

const getMovieId = async (movieName: string) => {
  const url = `${baseUrl}/search/movie?query=${movieName}&include_adult=true&language=en-US&page=1`;
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3YmM3NjhkY2YzMmZmZTZmMTMzZTVkMDhlMDg5MTgyNiIsIm5iZiI6MTcyMDI2NDc2NC4xMDAyMzIsInN1YiI6IjY2ODkyNjY2MjBlODcyZGE2NmEwNjIxMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.u01Mjer3_VU9NLR867c8HFpWarF5BZ2XYjDPbBB2TWc",
    },
  };
  const res = await fetch(url, options);

  const data = await res.json();
  const id = data["results"][0]["id"];

  return id;
};

const getMovieDetails = async (movieId: string) => {
  const url = `${baseUrl}/movie/${movieId}?language=en-US`;
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3YmM3NjhkY2YzMmZmZTZmMTMzZTVkMDhlMDg5MTgyNiIsIm5iZiI6MTcyMDI2NDc2NC4xMDAyMzIsInN1YiI6IjY2ODkyNjY2MjBlODcyZGE2NmEwNjIxMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.u01Mjer3_VU9NLR867c8HFpWarF5BZ2XYjDPbBB2TWc",
    },
  };
  const res = await fetch(url, options);

  const movieData = await res.json();

  return movieData;
};

app.get("/:movieName", async (req: Request, res: any) => {
  const id = await getMovieId(req.params.movieName);
  const movieData = await getMovieDetails(id);
  return res.send(movieData);
});

export const movieDetails = onRequest(app);
