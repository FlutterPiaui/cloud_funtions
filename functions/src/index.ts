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
  const url = `${baseUrl}/movie/${movieId}?language=en-US`;
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: apiKey,
    },
  };

  const res = await fetch(url, options);
  const movieData = await res.json();

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
      res.status(500).send({error: "Something went wrong"});
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
    res.status(500).send({error: "Something went wrong"});
  }
});

export const api = onRequest(app);
