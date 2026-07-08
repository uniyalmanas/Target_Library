async function checkLive() {
  const url = "https://library-ms-three.vercel.app/api/seats";
  console.log(`Fetching from live API: ${url}`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error("Live response is not an array:", data);
      return;
    }
    const seat154 = data.find((s) => s.seat_number === 154);
    console.log("Seat 154 data from live API:", JSON.stringify(seat154, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

checkLive();
