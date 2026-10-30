const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/02e860be-764f-4e7c-b303-bdd653bda640";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
