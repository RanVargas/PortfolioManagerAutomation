import { Octokit, App } from "octokit";
import dotenv from 'dotenv';
import fs from 'fs';
import { createAppAuth } from "@octokit/auth-app";


dotenv.config()


  async function getText(url) {

    // Fetch request
    const response = await fetch(url);
  
    // Handle response
    if(response.ok) {
      const text = await response.text();
      return text;
    } else {
      throw new Error('Request failed'); 
    }
  }
  

  const username = 'RanVargas';
  let repoToRetrieve = '';
  const octokit = new Octokit({
    auth: process.env.OVERLORDTOKEN
  })
  
  let reposData = await octokit.request('GET /users/{username}/repos', {
    username: 'RanVargas',
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  let reposReadmeOjb = [];
  let reposReadmeContent = [];
  await Promise.all(
    reposData.data.map(async (repo) => {
      try {
        const result = await octokit.request("GET /repos/{owner}/{repo}/readme", {
          owner: username,
          repo: repo.name, 
          headers: {
            'X-GitHub-Api-Version': '2022-11-28'
          }  
        });
        reposReadmeOjb.push(result);
      } catch (error) {
        if (error.status === 404) {
          // No readme found, skip this repo
          console.log(`No readme found for ${repo.name}`);
        } else {
          throw error; // rethrow other errors
        }
      }
    })
  );
  await Promise.all(
    reposReadmeOjb.map(async (data) => {
        try {
            const seachKeyword = "NatsukiSubaru";
            const text = await getText(data.data.download_url);
            const resolved = new RegExp(`\\b${seachKeyword}\\b`, 'i');
            
            if (resolved.test(text)) {
                console.log(`String contains ${word}`); 
            }
            //reposReadmeContent.push(await getText(data.data.download_url))
        } catch (error) {
            console.log(error)
        }
    })
  )


console.log(reposReadmeContent);

new RegExp("\\b" + lookup + "\\b").test(textbox.value)