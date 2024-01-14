#### About

A simple backend to provide HLS streaming for video content delivery. It allows fetching existing channels and further details about each channel ( current film, offset etc )

#### Requirements

Needs FFMPEG to be installed on machine

#### To run
Ensure FFmpeg is installed on your system

- Via [Chocolatey package manager](https://chocolatey.org/install) [windows]:

```
choco install ffmpeg-full
```

- Via Official site https://ffmpeg.org/download.html
  
then you can run:

```
npm start
```

use companion UI: https://github.com/gemFromJa/streaming-frontend

### API Overview

1. **```/videos/channels```**
   -- Get all available channels on the server
   
   Type: ```GET```
   
   Returns: ```{ success, data: { channels }, error? }```

   | Name | Type | Description |
    | ---- | ---- | ---- |
    | success | Boolean | if query failed or succeeded |
    | data.channels | String[] | the list of channel ids |
   | error | String| the error message from server |
   
3. **```/videos/:channel_id/offset```**
   -- [Dynamic Route] Get the details of the movie on a specific channel ( :channel_id )
   
   Type: ```GET```
   
   Returns: ```{ success, data: { movie: { currentOffset, name, duration, url } }, error? }```
   
    | Name | Type | Description |
    | ---- | ---- | ---- |
    | success | Boolean | if query failed or succeeded |
    | data.movie.currentOffset | number | the current point to begin streaming from |
   | data.movie.name | String | the name of the current movie |
   | data.movie.url | String | the url for the m3u8 playlist |
   | error | String| the error message from server |
   
5. **```/videos/```**
   -- admin upload route a movie which is then transcoded and becomes available on all channels
   
   Type: ```POST```

   Body: film, name

    | Name | Type | Description |
    | ---- | ---- | ---- |
    | film | File | the movie being uploaded |
    | name | String | the name of the move |


   Returns: ```{ success, data, error? }```
   
   | Name | Type | Description |
    | ---- | ---- | ---- |
    | success | Boolean | if query failed or succeeded |
    | data | String | the success message |
   | error | String| the error message from server |

   

