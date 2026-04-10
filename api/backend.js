export default async function handler(req, res) {

  // 🔥 HARDCODE (sesuai request lo)
  const cloudName = "dzbpzdqao";
  const apiKey = "978144777229154";
  const apiSecret = "kb5h-WryZaiBzR7g3qulAF45iTo";

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");

  try {

    // =============================
    // 🔁 FUNCTION FETCH PAGINATION
    // =============================
    async function getAllResources(url) {
      let all = [];
      let nextCursor = null;

      do {
        const finalUrl = nextCursor
          ? `${url}&next_cursor=${nextCursor}`
          : url;

        const response = await fetch(finalUrl, {
          headers: {
            Authorization: `Basic ${auth}`
          }
        });

        const data = await response.json();

        if (data.resources) {
          all.push(...data.resources);
        }

        nextCursor = data.next_cursor;

      } while (nextCursor);

      return all;
    }

    // =============================
    // 🔥 AMBIL SEMUA TIPE
    // =============================
    const images = await getAllResources(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?max_results=100`
    );

    const videos = await getAllResources(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/video?max_results=100`
    );

    const raws = await getAllResources(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/raw?max_results=100`
    );

    // =============================
    // 🔥 GABUNG SEMUA
    // =============================
    const resources = [
      ...images,
      ...videos,
      ...raws
    ];

    // =============================
    // 🔥 FILTER PROJECT AJA
    // =============================
    const filtered = resources.filter(r =>
      r.public_id.includes("PROJECT_PENDING_")
    );

    // =============================
    // 🔥 SORT TERBARU
    // =============================
    filtered.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

    // =============================
    // 🔥 RETURN KE FRONTEND
    // =============================
    res.status(200).json({
      total: filtered.length,
      resources: filtered
    });

  } catch (err) {
    res.status(500).json({
      error: "backend error",
      message: err.message
    });
  }
}
