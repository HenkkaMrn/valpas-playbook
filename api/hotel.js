const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID  = '5ee3cc14bc10406b9147ce1fb4d8ef92';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')     return res.status(405).json({ error: 'Method not allowed' });

  const q = (req.query.q || '').trim();
  if (!q)              return res.status(400).json({ error: 'Missing query parameter q' });
  if (!NOTION_TOKEN)   return res.status(500).json({ error: 'NOTION_TOKEN not configured' });

  const notionRes = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization:    `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type':   'application/json',
    },
    body: JSON.stringify({
      filter: { property: 'Hotel Name', title: { contains: q } },
      sorts:  [{ property: 'Hotel Name', direction: 'ascending' }],
      page_size: 10,
    }),
  });

  if (!notionRes.ok) {
    const text = await notionRes.text();
    return res.status(notionRes.status).json({ error: text });
  }

  const data   = await notionRes.json();
  const hotels = data.results.map(page => {
    const p = page.properties;
    return {
      id:                   page.id,
      url:                  page.url,
      name:                 richText(p['Hotel Name']?.title),
      city:                 multiSelect(p['City']),
      group:                multiSelect(p['Group']),
      rooms:                p['Rooms']?.number ?? null,
      gateways:             p['Number of Gateways']?.number ?? null,
      installationType:     multiSelect(p['Type of Installation']),
      leadContact:          richText(p['Lead contact']?.rich_text),
      status:               p['Post Sale Status']?.status?.name ?? null,
      installationSchedule: p['Installation schedule']?.date?.start ?? null,
      installationDone:     p['Installation done']?.date?.start ?? null,
      deliveryDone:         p['Delivery done']?.date?.start ?? null,
    };
  });

  return res.status(200).json(hotels);
};

function richText(arr) {
  if (!arr?.length) return null;
  return arr.map(t => t.plain_text).join('');
}

function multiSelect(prop) {
  if (!prop?.multi_select) return [];
  return prop.multi_select.map(o => o.name);
}
