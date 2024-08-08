import {onRequest} from "firebase-functions/v2/https";
import * as express from "express";
import fetch from "node-fetch";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {logger} from "firebase-functions";

const app = express.default();
app.use(express.json());

const baseUrl = "https://api.themoviedb.org/3";
const apiKey = `Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3YmM3
NjhkY2YzMmZmZTZmMTMzZTVkMDhlMDg5MTgyNiIsIm5iZiI6MTcyMDI2NDc2NC4xM
DAyMzIsInN1YiI6IjY2ODkyNjY2MjBlODcyZGE2NmEwNjIxMiIsInNjb3BlcyI6WyJh
cGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.u01Mjer3_
VU9NLR867c8HFpWarF5BZ2XYjDPbBB2TWc`.replace(/\n/g, "");

const formatPrompt = (prompt: string, language: string) => {
  return ` Please provide five movies that are similar to "${prompt}". Provide the titles of the
   movies in English, the titles of the movies in ${language}, poster of the movies, description of the movies in ${language}
   and where to watch them in JSON format like this '{"result":true, "count":42}' without this
   \`\`\`json in the beginning and this \`\`\` in the end. The
   JSON object should have the keys "title", "title_${language}", "streaming_platform", "image", "description"
   If a movie is not available on a streaming platform, please indicate "Not Available".`;
};

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

const getMovieId = async (movieName: string) => {
  const url =
    `${baseUrl}/search/movie?query=${movieName}&include_adult=true&language=en-US&page=1`.replace(
      /\n/g,
      ""
    );
  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: apiKey,
    },
  };

  try {
    const res = await fetch(url, options);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].id;
    } else {
      logger.warn(`No results found for movie: ${movieName}`);
      return null;
    }
  } catch (error) {
    logger.error(`Error fetching movie ID for ${movieName}:`, error);
    throw new Error(`Error fetching movie ID for ${movieName}`);
  }
};

const getMovieDetails = async (movieId: string) => {
  const movieDetailUrl = `${baseUrl}/movie/${movieId}?language=pt-BR`;
  const movieVideosUrl = `${baseUrl}/movie/${movieId}/videos?language=pt-BR`;
  const movieProvidersUrl = `${baseUrl}/movie/${movieId}/watch/providers?language=pt-BR`;
  const movieRecommendationsUrl = `${baseUrl}/movie/${movieId}/recommendations?language=pt-BR`;

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      Authorization: apiKey,
    },
  };

  try {
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

    const movieRecommendations = movieRecommendationsData["results"].slice(
      0,
      6
    );

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
  } catch (error) {
    logger.error(`Error fetching movie details for ID ${movieId}:`, error);
    throw new Error(`Error fetching movie details for ID ${movieId}`);
  }
};

app.get(
  "/movie/:movieName",
  async (req: express.Request, res: express.Response) => {
    try {
      const id = await getMovieId(req.params.movieName);
      if (!id) {
        res.status(404).send({error: "Movie not found"});
        return;
      }
      const movieData = await getMovieDetails(id);
      res.json(movieData); // Agora inclui a URL completa do pôster
    } catch (error) {
      logger.error(`Error handling GET /movie/${req.params.movieName}:`, error);
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

  const cleanedText = text.replace(/```json\n|\n```/g, "");

  return cleanedText;
};

app.post("/gemini", async (req: express.Request, res: express.Response) => {
  try {
    logger.info("Received request:", req.body);
    const prompt = req.body.prompt;
    const language = req.body.language;
    const geminiResponse = await sendPromptToGemini(
      formatPrompt(prompt, language)
    );
    logger.info("Gemini response:", geminiResponse);

    const parsedResponse = JSON.parse(geminiResponse);
    const movies = parsedResponse.movies;

    if (!Array.isArray(movies)) {
      throw new Error("Invalid response format: 'movies' is not an array");
    }

    for (const movie of movies) {
      try {
        const movieId = await getMovieId(movie.title);
        if (movieId) {
          const movieDetails = await getMovieDetails(movieId);
          movie.image = movieDetails.poster_url;
        } else {
          movie.image = "https://example.com/default-poster.jpg";
        }
      } catch (error) {
        logger.error(`Error processing movie: ${movie.title}`, error);
        movie.image = "https://example.com/default-poster.jpg";
      }
    }

    res.json(movies);
  } catch (error) {
    logger.error("Error in /gemini endpoint:", error);
    res.status(500).send({error: "Something went wrong"});
  }
});

export const api = onRequest(app);
