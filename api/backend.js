export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {

  // 🔥 ISI PUNYA LU
  const cloudName = "dzbpzdqao";
  const apiKey = "978144777229154";
  const apiSecret = "kb5h-WryZaiBzR7g3qulAF45iTo";

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  try {

    // =========================
    // GET (LOAD DATA BESAR)
    // =========================
    if (req.method === "GET") {

      let result = [];

      // helper ambil semua halaman (pagination cloudinary)
      async function fetchAll(url) {
        let all = [];
        let next = null;

        do {
          const finalUrl = next ? `${url}&next_cursor=${next}` : url;

          const res = await fetch(finalUrl, {
            headers: { Authorization: `Basic ${auth}` }
          });

          const data = await res.json();

          all.push(...(data.resources || []));
          next = data.next_cursor;

        } while (next);

        return all;
      }

      // 🔥 ambil SEMUA data (bukan cuma 100)
      const images = await fetchAll(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?max_results=100`
      );

      const videos = await fetchAll(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/video?max_results=100`
      );

      const raws = await fetchAll(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/raw?max_results=100`
      );

      // =========================
      // FORMAT DATA
      // =========================

      // IMAGE
      images.forEach(item => {
        if (!item.public_id.startsWith("img_BY_")) return;

        const user = item.public_id.split("_")[2];

        result.push({
          type: "image",
          user,
          url: item.secure_url,
          created: item.created_at
        });
      });

      // AUDIO
      videos.forEach(item => {
        if (!item.public_id.startsWith("audio_BY_")) return;

        const user = item.public_id.replace("audio_BY_", "");

        result.push({
          type: "audio",
          user,
          url: item.secure_url,
          created: item.created_at
        });
      });

      // NOTE
      for (const item of raws) {
        if (!item.public_id.startsWith("note_BY_")) continue;

        const user = item.public_id.replace("note_BY_", "");

        let text = "";
        try {
          text = await fetch(item.secure_url).then(r => r.text());
        } catch {}

        result.push({
          type: "note",
          user,
          text,
          created: item.created_at
        });
      }

      // 🔥 SORT TERBARU
      result.sort((a, b) => new Date(b.created) - new Date(a.created));

      return res.status(200).json(result);
    }

    // =========================
    // POST (UPLOAD)
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

      // ===== FILE (AUDIO / IMAGE) =====
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

      if (type === "audio") {
        uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
        public_id = `audio_BY_${user}`;
      }

      if (type === "image") {
        uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
        public_id = `img_BY_${user}_${Date.now()}`;
      }

      const body = new URLSearchParams();
      body.append(
        "file",
        `data:${file.type};base64,${buffer.toString("base64")}`
      );
      body.append("public_id", public_id);
      body.append("overwrite", "true");

      const upload = await fetch(uploadUrl, {
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
