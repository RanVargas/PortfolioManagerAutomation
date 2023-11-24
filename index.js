import Octokit from 'octokit';
import dotenv from 'dotenv';
import { Stream } from 'stream';
import fetch from 'node-fetch';


export const handler = async (event) => {
  dotenv.config();

  const BUCKET_NAME = "project-caching";

  async function getText(url) {
    // Fetch request
    const response = await fetch(url);
    // Handle response
    if (response.ok) {
      const text = await response.text();
      return text;
    } else {
      throw new Error("Request failed");
    }
  }

  async function uploadAssests(
    downloadUrl,
    bucketName,
    projectName,
    projectAsset
  ) {
    const AWS = require("aws-sdk");
    const s3 = new AWS.S3();
    const https = require("https");
    const url = downloadUrl;
    const bucket = bucketName;
    const key = `${projectName}/${projectAsset}`;

    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        // Get data stream from response
        const streamer = Stream.PassThrough();
        const stream = res.pipe(streamer);
        const params = {
          Bucket: bucket,
          Key: key,
          Body: stream,
        };
        // Upload stream to S3

        s3.upload(params, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    });
  }

  async function emptyBucket(bucket) {
    const AWS = require("aws-sdk");
    const s3 = new AWS.S3();

    let listParams = {
      Bucket: bucket,
    };

    let listedObjects;

    do {
      listedObjects = await s3.listObjectsV2(listParams).promise();

      if (listedObjects.Contents.length === 0) return;

      let deleteParams = {
        Bucket: bucket,
        Delete: { Objects: [] },
      };

      listedObjects.Contents.forEach(({ Key }) => {
        deleteParams.Delete.Objects.push({ Key });
      });

      await s3.deleteObjects(deleteParams).promise();

      if (listedObjects.IsTruncated) {
        listParams.ContinuationToken = listedObjects.NextContinuationToken;
      }
    } while (listedObjects.IsTruncated);
  }

  async function getAllGithubAssetsLinks(repoName) {
    const values = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner: "RanVargas",
        repo: repoName,
        path: "/showcase",
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    return values;
  }

  const username = "RanVargas";
  const octokit = new Octokit({
    auth: process.env.OVERLORDTOKEN,
  });

  let reposReadmeOjb = {};
  let reposReadmeContent = [];
  let reposData = await octokit.request("GET /users/{username}/repos", {
    username: "RanVargas",
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  await Promise.all(
    reposData.data.map(async (repo) => {
      try {
        const result = await octokit.request(
          "GET /repos/{owner}/{repo}/readme",
          {
            owner: username,
            repo: repo.name,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );
        reposReadmeOjb[repo.name] = result;
      } catch (error) {
        if (error.status === 404) {
          // No readme found, skip this repo
        } else {
          throw error; // rethrow other errors
        }
      }
    })
  );

  let projects = {};
  for (const [key, value] of Object.entries(reposReadmeOjb)) {
    try {
      const seachKeyword = "NatsukiSubaru";
      const text = await getText(value.data.download_url);
      const resolved = new RegExp(`\\b${seachKeyword}\\b`, "i");
      if (resolved.test(text)) {
        projects[key] = value;
      }
    } catch (error) {
      console.log(error);
    }
  }

  for (const [key, value] of Object.entries(projects)) {
    try {
      const assetsLinks = await getAllGithubAssetsLinks(key);
      emptyBucket(BUCKET_NAME);
      assetsLinks.data.map(async (dataObj) => {
        try {
          await uploadAssests(
            dataObj.download_url,
            BUCKET_NAME,
            key,
            dataObj.name
          );
          console.log(`${dataObj.name} has been uploaded`);
        } catch (error) {
          const response = {
            statusCode: 400,
            body: JSON.stringify(`Error encountered: ${error}`),
          };
          return response;
        }
      });
    } catch (error) {
      const response = {
        statusCode: 400,
        body: JSON.stringify(`Error encountered: ${error}`),
      };
      return response;
    }
  }
  const response = {
    statusCode: 200,
    body: JSON.stringify("Ran successfully"),
  };
  return response;
};

// Runs every cron(0 1 ? * SUN *)
