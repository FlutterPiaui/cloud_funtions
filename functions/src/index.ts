import {onRequest} from "firebase-functions/v2/https";
import * as express from "express";
import fetch from "node-fetch";
import {GoogleGenerativeAI} from "@google/generative-ai";
// import { logger } from "firebase-functions/v1";

const app = express.default();
app.use(express.json());

const baseUrl = "https://api.themoviedb.org/3";
const apiKey = `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3YmM3
NjhkY2YzMmZmZTZmMTMzZTVkMDhlMDg5MTgyNiIsIm5iZiI6MTcyMDI2NDc2NC4xM
DAyMzIsInN1YiI6IjY2ODkyNjY2MjBlODcyZGE2NmEwNjIxMiIsInNjb3BlcyI6WyJh
cGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.u01Mjer3_
VU9NLR867c8HFpWarF5BZ2XYjDPbBB2TWc`.replace(/\n/g, "");

const languageChoicePrompt = (language: string) =>
  `The language chosen was ${language}`;

const defaultPrompt = () =>
  `. Please provide the titles of the
   movies in english, titles of the movies in
  the chosen language, post of the movies in
  the chosen language, description in
  the chosen language
  of the movies and where to watch them in JSON format
   like this '{"result":true, "count":42}' without this
   \`\`\`json in the beginning and this \`\`\` in the end. The
   JSON object should have the keys
    "englishTitle", "title", "streaming_platform", "image", "description"
   If a movie is not available on a streaming platform,
   please indicate "Not Available".`;

interface MovieVideo {
  type: string;
  key: string;
}

interface Provider {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
}

interface ProvidersResult {
  link: string;
  flatrate?: Provider[];
  rent?: Provider[];
  buy?: Provider[];
}

const formatPrompt = (prompt: string, language: string) => {
  return `${prompt}${defaultPrompt()}${languageChoicePrompt(language)}`;
};

const getMovieId = async (movieName: string) => {
  const url = `${baseUrl}/search/movie?query=${movieName}
  &include_adult=true&language=en-US&page=1`.replace(/\n/g, "");
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: apiKey,
    },
  };
  const res = await fetch(url, options);
  const data = await res.json();
  const id = data["results"][0]["id"];
  return id;
};

const getMovieDetails = async (movieId: string) => {
  const movieDetailUrl = `${baseUrl}/movie/${movieId}?language=pt-BR`;
  const movieVideosUrl = `${baseUrl}/movie/${movieId}/videos?language=pt-BR'`;
  const movieProvidersUrl = `${baseUrl}/movie/${movieId}/watch/providers?language=pt-BR'`;
  const movieRecommendationsUrl = `${baseUrl}/movie/${movieId}/recommendations?language=pt-BR'`;

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: apiKey,
    },
  };

  const movieDetailResponse = await fetch(movieDetailUrl, options);
  const movieData = await movieDetailResponse.json();

  const movieVideosResponse = await fetch(movieVideosUrl, options);
  const movieVideosData = await movieVideosResponse.json();

  const movieProvidersResponse = await fetch(movieProvidersUrl, options);
  const movieProvidersData = await movieProvidersResponse.json();

  const movieRecommendationsResponse = await fetch(
    movieRecommendationsUrl,
    options
  );
  const movieRecommendationsData = await movieRecommendationsResponse.json();

  const movieTrailer: MovieVideo = movieVideosData["results"].find(
    (video: MovieVideo) => video["type"] === "Trailer"
  );

  const movieProviders: ProvidersResult = movieProvidersData["results"]["BR"];

  const movieRecommendations = movieRecommendationsData["results"].slice(0, 6);

  movieData[
    "trailerUrl"
  ] = `https://www.youtube.com/watch?v=${movieTrailer["key"]}`;

  movieData["providers"] = movieProviders["flatrate"];

  movieData["recommendations"] = movieRecommendations;

  if (movieData.poster_path) {
    movieData.poster_url = `https://image.tmdb.org/t/p/w500/${movieData.poster_path}`;
  } else {
    movieData.poster_url = "https://example.com/default-poster.jpg";
  }

  return movieData;
};

app.get(
  "/movie/:movieName",
  async (req: express.Request, res: express.Response) => {
    try {
      const id = await getMovieId(req.params.movieName);
      const movieData = await getMovieDetails(id);
      res.json(movieData);
    } catch (error) {
      res.status(500).send(error);
    }
  }
);

const sendPromptToGemini = async (prompt: string) => {
  const apiKey = "AIzaSyDLiWuBeNFgibVQMbBUYSyhXpa15Ltf8sI";
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({model: "gemini-1.5-flash"});
  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();

  return text;
};

app.post("/gemini", async (req: express.Request, res: express.Response) => {
  try {
    const prompt = req.body.prompt;
    const language = req.body.language;
    const geminiResponse = await sendPromptToGemini(
      formatPrompt(prompt, language)
    );

    res.json(JSON.parse(geminiResponse.slice(7, -3)));
  } catch (error) {
    res.status(500).send(error);
  }
});

export const api = onRequest(app);
