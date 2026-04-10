export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {

  // 🔥 WAJIB ISI
  const cloudName = "dzbpzdqao";
  const apiKey = "978144777229154";
  const apiSecret = "kb5h-WryZaiBzR7g3qulAF45iTo";

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  try {

    // =========================
    // GET DATA
    // =========================
    if (req.method === "GET") {

      let result = [];

      // IMAGE
      const img = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/image`,
        { headers: { Authorization: `Basic ${auth}` } }
      ).then(r => r.json());

      (img.resources || []).forEach(item => {
        if (!item.public_id.startsWith("img_BY_")) return;

        const user = item.public_id.split("_")[2];

        result.push({
          type: "image",
          user,
          url: item.secure_url
        });
      });

      // AUDIO (pakai VIDEO biar stabil)
      const vid = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/video`,
        { headers: { Authorization: `Basic ${auth}` } }
      ).then(r => r.json());

      (vid.resources || []).forEach(item => {
        if (!item.public_id.startsWith("audio_BY_")) return;

        const user = item.public_id.replace("audio_BY_", "");

        result.push({
          type: "audio",
          user,
          url: item.secure_url
        });
      });

      // NOTE (RAW)
      const raw = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/raw`,
        { headers: { Authorization: `Basic ${auth}` } }
      ).then(r => r.json());

      for (const item of raw.resources || []) {
        if (!item.public_id.startsWith("note_BY_")) continue;

        const user = item.public_id.replace("note_BY_", "");

        let text = "";
        try {
          text = await fetch(item.secure_url).then(r => r.text());
        } catch {}

        result.push({
          type: "note",
          user,
          text
        });
      }

      return res.status(200).json(result);
    }

    // =========================
    // POST UPLOAD
    // =========================
    if (req.method === "POST") {

      const contentType = req.headers["content-type"] || "";

      // ===== NOTE =====
      if (contentType.includes("application/json")) {
        const { type, user, text } = req.body;

        if (type === "note") {

          const body = new URLSearchParams();
          body.append(
            "file",
            `data:text/plain;base64,${Buffer.from(text).toString("base64")}`
          );
          body.append("public_id", `note_BY_${user}`);
          body.append("overwrite", "true");

          const upload = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body,
            }
          ).then(r => r.json());

          return res.status(200).json(upload);
        }
      }

      // ===== AUDIO / IMAGE =====
      const formData = await req.formData();
      const type = formData.get("type");
      const user = formData.get("user");
      const file = formData.get("file");

      if (!file || !user || !type) {
        return res.status(400).json({ error: "Missing data" });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      let url = "";
      let public_id = "";

      if (type === "audio") {
        public_id = `audio_BY_${user}`;
        url = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
      }

      if (type === "image") {
        public_id = `img_BY_${user}_${Date.now()}`;
        url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      }

      const body = new URLSearchParams();
      body.append(
        "file",
        `data:${file.type};base64,${buffer.toString("base64")}`
      );
      body.append("public_id", public_id);
      body.append("overwrite", "true");

      const upload = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }).then(r => r.json());

      if (upload.error) {
        return res.status(500).json(upload);
      }

      return res.status(200).json({
        url: upload.secure_url
      });
    }

    return res.status(405).end();

  } catch (err) {
    console.log("ERROR:", err);

    return res.status(500).json({
      error: "server error",
      message: err.message
    });
  }
}
