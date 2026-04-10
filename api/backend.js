export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  const cloudName = "dzbpzdqao";
  const apiKey = "978144777229154";
  const apiSecret = "kb5h-WryZaiBzR7g3qulAF45iTo";

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  try {

    // =========================
    // GET → ambil semua data
    // =========================
    if (req.method === "GET") {

      // ambil image
      const imgRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?max_results=100`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      const imgData = await imgRes.json();

      // ambil raw (note + audio)
      const rawRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/raw?max_results=100`,
        { headers: { Authorization: `Basic ${auth}` } }
      );
      const rawData = await rawRes.json();

      const result = [];

      // IMAGE
      (imgData.resources || []).forEach(item => {
        const match = item.public_id.match(/BY_(@[A-Za-z0-9_]+)/);
        if (!match) return;

        result.push({
          type: "image",
          user: match[1].toLowerCase(),
          url: item.secure_url
        });
      });

      // RAW (NOTE + AUDIO)
      (rawData.resources || []).forEach(item => {

        // NOTE
        if (item.public_id.startsWith("note_BY_")) {
          const user = item.public_id.replace("note_BY_", "");

          result.push({
            type: "note",
            user,
            url: item.secure_url // nanti di fetch text di frontend (optional)
          });
        }

        // AUDIO
        if (item.public_id.startsWith("audio_BY_")) {
          const user = item.public_id.replace("audio_BY_", "");

          result.push({
            type: "audio",
            user,
            url: item.secure_url
          });
        }

      });

      return res.status(200).json(result);
    }

    // =========================
    // POST → upload
    // =========================
    if (req.method === "POST") {

      const contentType = req.headers["content-type"] || "";

      // ===== NOTE =====
      if (contentType.includes("application/json")) {
        const { type, user, text } = req.body;

        if (type === "note") {

          const public_id = `note_BY_${user}`;

          const body = new URLSearchParams();
          body.append(
            "file",
            `data:text/plain;base64,${Buffer.from(text).toString("base64")}`
          );
          body.append("public_id", public_id);
          body.append("overwrite", "true");

          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body,
            }
          );

          const data = await response.json();
          return res.status(200).json(data);
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

      let uploadUrl = "";
      let public_id = "";

      // AUDIO → RAW
      if (type === "audio") {
        public_id = `audio_BY_${user}`;
        uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;
      }

      // IMAGE → IMAGE
      if (type === "image") {
        public_id = `img_BY_${user}_${Date.now()}`;
        uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      }

      const body = new URLSearchParams();
      body.append(
        "file",
        `data:${file.type};base64,${buffer.toString("base64")}`
      );
      body.append("public_id", public_id);
      body.append("overwrite", "true");

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      const data = await response.json();

      if (data.error) {
        return res.status(500).json(data);
      }

      return res.status(200).json({
        url: data.secure_url
      });
    }

    return res.status(405).end();

  } catch (err) {
    return res.status(500).json({
      error: "server error",
      message: err.message
    });
  }
}
