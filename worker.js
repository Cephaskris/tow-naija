const APK_DOWNLOAD_URL = "https://charming-donkey-521.convex.cloud/api/storage/d63b5b51-bb41-43dc-af70-aa09e7ba5125";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/Townaija.apk" || url.pathname.toLowerCase() === "/townaija.apk") {
      return Response.redirect(APK_DOWNLOAD_URL, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
