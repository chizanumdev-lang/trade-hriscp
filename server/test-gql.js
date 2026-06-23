async function test() {
  const q = `
    query {
      allProbationRequests {
        id
      }
    }
  `;
  const res = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
