const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/c819434e-68ae-4046-88e4-f9ce54e2768e";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
