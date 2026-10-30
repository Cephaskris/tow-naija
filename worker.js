const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/kg2833xsrg4dzjtq20z8n09h7n8h8rpn";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
