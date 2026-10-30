const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/1d6de9bd-73fb-454c-8f2b-1896843598c5";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
