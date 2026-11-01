const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/117e332b-fa68-4c80-89c1-7f477f85d47d";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
