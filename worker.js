const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/0fd498e2-249e-42b2-b79e-2ac837e3ece1";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
