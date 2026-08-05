## Formats

Every method can return its results in 3 different formats: JSON, XML, and VDF. Each format represents the data described herein differently:

### JSON
* The API returns an object containing the named object with the result data.
* Arrays are represented as an array with the name of the type of the objects in the array (i.e. an object named "items" containing an array of objects of type "item" would be represented as an object named "items" containing an array named "item" containing several objects following the "item" structure).
* Null is represented as JSON's `null`.

### XML
* XML Attributes are not used.
* Arrays are represented as a series of sub-elements in the containing element of the type of the array.
* Null is represented by the word "null" between the element's tags.

### VDF (Valve Data Format)
* This is Valve's internal data format, as seen in uses like TF2's "scripts" folder (available in "team fortress 2 client content.gcf"). TF2's `GetSchema` returns data similar to `items/items_game.txt` (although qualities are not expanded into objects with a "value" field).
* Documentation of the format is in progress [here](KeyValues).
* Arrays in the data are represented as a VDF array with the name of the type of the objects in the array, with a VDF array being an object with each item being prefixed with its numeric key as a quoted string.
* Null is represented as an empty string.

If no format is specified, the API will default to JSON.

---

## Interfaces and Methods

All interfaces and methods are self-documented through the `ISteamWebAPIUtil/GetSupportedAPIList` call. This can be found [here](https://api.steampowered.com/ISteamWebAPIUtil/GetSupportedAPIList/v0001/).

When passed a `key=<your API key>` parameter, `GetSupportedAPIList` will show all APIs that your key can access. Without it (as above), it only displays APIs that do not require an API key.

### Game Interfaces and Methods

Team Fortress 2 functions are described at [https://wiki.teamfortress.com/wiki/WebAPI](https://wiki.teamfortress.com/wiki/WebAPI).

---

### GetNewsForApp (v0002)

GetNewsForApp returns the latest news of a game specified by its appID.

**Example URL:**  
`https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=440&count=3&maxlength=300&format=json`

#### Arguments

* **`appid`**
  * AppID of the game you want the news of.
* **`count`**
  * How many news entries you want to get returned.
* **`maxlength`**
  * Maximum length of each news entry.
* **`format`**
  * Output format: `json` (default), `xml`, or `vdf`.

#### Result Layout

An **`appnews`** object containing:

* **`appid`**: The AppID of the game you want news of.
* **`newsitems`**: An array of news item information:
  * An ID, title, and url.
  * A shortened excerpt of the contents (to `maxlength` characters), terminated by "..." if longer than `maxlength`.
  * A comma-separated string of labels and UNIX timestamp.

---

### GetGlobalAchievementPercentagesForApp (v0002)

Returns an global achievements overview of a specific game in percentages.

**Example URL:**  
`https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=440&format=xml`

#### Arguments

* **`gameid`**
  * AppID of the game you want the news of.
* **`format`**
  * Output format: `json` (default), `xml`, or `vdf`.

---

### GetPlayerSummaries (v0002)

Returns basic profile information for a list of 64-bit Steam IDs.

**Example URL:**  
`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=XXXXXXXXXXXXXXXXXXXXXXX&steamids=76561197960435530`  
*(This will show Robin Walker's profile information.)*

#### Arguments

* **`steamids`**
  * Comma-delimited list of 64-bit Steam IDs to return profile information for. Up to 100 Steam IDs can be requested.
* **`format`**
  * Output format: `json` (default), `xml`, or `vdf`.

#### Return Value

Some data associated with a Steam account may be hidden if the user has their profile visibility set to "Friends Only" or "Private". In that case, only public data will be returned.

##### Public Data

* **`steamid`**: 64-bit SteamID of the user.
* **`personaname`**: The player's persona name (display name).
* **`profileurl`**: The full URL of the player's Steam Community profile.
* **`avatar`**: The full URL of the player's 32x32px avatar. If the user hasn't configured an avatar, this will be the default avatar.
* **`avatarmedium`**: The full URL of the player's 64x64px avatar. If the user hasn't configured an avatar, this will be the default avatar.
* **`avatarfull`**: The full URL of the player's 184x184px avatar. If the user hasn't configured an avatar, this will be the default avatar.
* **`personastate`**: The user's current status:  
  `0` - Offline, `1` - Online, `2` - Busy, `3` - Away, `4` - Snooze, `5` - Looking to trade, `6` - Looking to play.  
  *If the player's profile is private, this will always be "0", except if the user has set their status to looking to trade or looking to play (due to a known bug).*
* **`communityvisibilitystate`**: Represents whether the profile is visible or not. Returned values: `1` - Private/Friends Only, `3` - Public.  
  > *Mike Blaszczak's post on Steam forums:* "The community visibility state this API returns is different than the privacy state. It's the effective visibility state from the account making the request to the account being viewed given the requesting account's relationship to the viewed account."
* **`profilestate`**: If set, indicates the user has a community profile configured (will be set to `1`).
* **`lastlogoff`**: The last time the user was online, in UNIX time.
* **`commentpermission`**: If set, indicates the profile allows public comments.

##### Private Data

* **`realname`**: The player's "Real Name", if set.
* **`primaryclanid`**: The player's primary group, as configured in their Steam Community profile.
* **`timecreated`**: The time the player's account was created.
* **`gameid`**: If the user is currently in-game, this value will be returned and set to the `gameid` of that game.
* **`gameserverip`**: The IP and port of the game server the user is currently playing on (if using Steam matchmaking). Otherwise set to `"0.0.0.0:0"`.
* **`gameextrainfo`**: If the user is currently in-game, this will be the name of the game they are playing (can be a non-Steam game shortcut).
* **`cityid`**: Deprecated / will be removed in a future update (see `loccityid`).
* **`loccountrycode`**: The user's country of residence (2-character ISO country code).
* **`locstatecode`**: The user's state of residence.
* **`loccityid`**: An internal code indicating the user's city of residence.
  * [`steam_location`](https://github.com/Holek/steam-friends-countries) gem/package makes player location data readable.
  * Updated list available at [`quer's steam location`](https://github.com/quer/steam-friends-countries).
  * Location querying can be made via: `https://steamcommunity.com/actions/QueryLocations/<loccountrycode>/<locstatecode>/`

---

### GetFriendList (v0001)

Returns the friend list of any Steam user, provided their Steam Community profile visibility is set to "Public".

**Example URL:**  
`https://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX&steamid=76561197960435530&relationship=friend`

#### Arguments

* **`steamid`**
  * 64-bit Steam ID to return friend list for.
* **`relationship`**
  * Relationship filter. Possible values: `all`, `friend`.
* **`format`**
  * Output format: `json` (default), `xml`, or `vdf`.

#### Result Data

The user's friends list as an array of friends. Nothing will be returned if the profile is private.

* **`steamid`**: 64-bit Steam ID of the friend.
* **`relationship`**: Relationship qualifier.
* **`friend_since`**: UNIX timestamp of when the relationship was created.

---

### GetPlayerAchievements (v0001)

Returns a list of achievements for this user by AppID.

**Example URL:**  
`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=440&key=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX&steamid=76561197972495328`

#### Arguments

* **`steamid`**
  * 64-bit Steam ID to return achievement list for.
* **`appid`**
  * The ID for the game you're requesting.
* **`l`** *(Optional)*
  * Language. If specified, returns localized data for the requested language.

#### Result Data

A list of achievements:

* **`apiname`**: The API name of the achievement.
* **`achieved`**: Whether or not the achievement has been completed (`1` or `0`).
* **`unlocktime`**: Date when the achievement was unlocked (UNIX timestamp).
* **`name`** *(Optional)*: Localized achievement name.
* **`description`** *(Optional)*: Localized description of the achievement.

---

### GetUserStatsForGame (v0002)

Returns a list of achievements and stats for this user by AppID.

**Example URL:**  
`https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=440&key=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX&steamid=76561197972495328`

#### Arguments

* **`steamid`**
  * 64-bit Steam ID to return stats for.
* **`appid`**
  * The ID for the game you're requesting.
* **`l`** *(Optional)*
  * Language. If specified, returns localized data for the requested language.

---

### GetOwnedGames (v0001)

Returns a list of games a player owns along with playtime information, if the profile is publicly visible. Private/Friends-only profiles are supported only if requesting your own details (i.e., using the API key linked to the requested `steamid`).

**Example URL:**  
`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=XXXXXXXXXXXXXXXXX&steamid=76561197960434622&format=json`

#### Arguments

* **`steamid`**
  * The SteamID of the account.
* **`include_appinfo`**
  * Include game name and logo information in the output. Default returns AppIDs only.
* **`include_played_free_games`**
  * Free games (e.g., Team Fortress 2) are excluded by default. Setting this includes them if played.
* **`format`**
  * Output format: `json` (default), `xml`, or `vdf`.
* **`appids_filter`**
  * Filter to a set of AppIDs. Must be passed using the JSON input format described in [Calling Service Interfaces](#calling-service-interfaces).  
    *Example JSON:* `"appids_filter": [ 440, 500, 550 ]`

#### Result Layout

* **`game_count`**: Total number of games owned.
* **`games`**: An array containing game details (if `include_appinfo` is omitted, only `appid`, `playtime_2weeks`, and `playtime_forever` are returned):
  * **`appid`**: Unique identifier for the game.
  * **`name`**: The name of the game.
  * **`playtime_2weeks`**: Total minutes played in the last 2 weeks.
  * **`playtime_forever`**: Total minutes played on record.
  * **`img_icon_url`**, **`img_logo_url`**: Image filenames. Construct URLs using:  
    `https://media.steampowered.com/steamcommunity/public/images/apps/{appid}/{hash}.jpg`
  * **`has_community_visible_stats`**: Indicates if a stats page is available. Uniform URL:  
    `https://steamcommunity.com/profiles/{steamid}/stats/{appid}`

---

### GetRecentlyPlayedGames (v0001)

Returns a list of games a player has played in the last two weeks, if the profile is publicly visible.

**Example URL:**  
`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=XXXXXXXXXXXXXXXXX&steamid=76561197960434622&format=json`

#### Arguments

* **`steamid`**
  * The SteamID of the account.
* **`count`**
  * Optionally limit the number of returned games.
* **`format`**
  * Output format: `json` (default), `xml`, or `vdf`.

#### Result Layout

* **`total_count`**: Total number of unique games played in the last 2 weeks.
* **`games`**: An array containing:
  * **`appid`**: Unique identifier for the game.
  * **`name`**: Name of the game.
  * **`playtime_2weeks`**: Total minutes played in the last 2 weeks.
  * **`playtime_forever`**: Total minutes played on record.
  * **`img_icon_url`**, **`img_logo_url`**: Filenames for game images.

---

### Community Pages Parameters

Most Steam Community information can be returned in XML format by appending `?xml=1` to their URLs. This method does not require an API key.

---

## Community Data

The Steam community data interface (XML only) is described at:  
[https://partner.steamgames.com/documentation/community_data](https://partner.steamgames.com/documentation/community_data)

---

## Calling Service Interfaces

Service WebAPIs (interfaces ending in "Service", such as `IPlayerService`) accept arguments as a single JSON blob in addition to standard GET/POST parameters.

**Example Request:**  
`?key=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX&format=json&input_json={"steamid": 76561197972495328}`

*Note: The JSON payload must be URL-encoded. The `key` and `format` parameters should remain separate query parameters.*

---

## Implementations

* [Steam Web API library](https://github.com/Overv/SteamWebAPI): C# library for Steam Friends interaction.
* [Steam Condenser](https://github.com/koraktor/steam-condenser): Ruby, PHP, and Java library.

---

## See Also

* Suggestions & Problems for Steam Web API
