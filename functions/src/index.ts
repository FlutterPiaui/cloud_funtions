import {onRequest} from "firebase-functions/v2/https";
import * as express from "express";
import fetch from "node-fetch";
import {GoogleGenerativeAI} from "@google/generative-ai";

const app = express.default();
app.use(express.json());

const baseUrl = "https://api.themoviedb.org/3";
const apiKey = `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3YmM3
NjhkY2YzMmZmZTZmMTMzZTVkMDhlMDg5MTgyNiIsIm5iZiI6MTcyMDI2NDc2NC4xM
DAyMzIsInN1YiI6IjY2ODkyNjY2MjBlODcyZGE2NmEwNjIxMiIsInNjb3BlcyI6WyJh
cGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.u01Mjer3_
VU9NLR867c8HFpWarF5BZ2XYjDPbBB2TWc`.replace(/\n/g, "");

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
  return movieData;
};

app.get(
  "/movie/:movieName",
  async (req: express.Request, res: express.Response) => {
    try {
      const id = await getMovieId(req.params.movieName);
      const movieData = await getMovieDetails(id);
      res.send(movieData);
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
  const response = await result.response;
  const text = response.text();

  return text;
};

app.post("/gemini", async (req: express.Request, res: express.Response) => {
  try {
    const prompt = req.body.prompt;
    const geminiResponse = await sendPromptToGemini(prompt);
    res.send({response: geminiResponse});
  } catch (error) {
    res.status(500).send({error: "Something went wrong"});
  }
});

export const api = onRequest(app);
