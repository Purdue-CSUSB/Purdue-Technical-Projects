import { useEffect, useState } from 'react';
import ItemCard from './Card.jsx';
import PageHeader, { PageShell } from './ui/PageHeader.jsx';

// Clubs and Events are the same page with different copy and a different JSON file: fetch a
// list from public/, render a card per entry, handle the loading and empty states. They were
// two near-identical files that had already drifted apart in small ways, so the shape lives
// here once and each page supplies only what actually differs.

export default function DirectoryPage({ title, accent, lead, source, dataKey, emptyMessage }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetch(source);
                if (!response.ok) throw new Error(`Failed to fetch ${source}`);
                const data = await response.json();
                if (!cancelled) setItems(data[dataKey] ?? []);
            } catch (error) {
                console.error(`Error loading ${source}:`, error);
                if (!cancelled) setItems([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [source, dataKey]);

    return (
        <PageShell width="max-w-5xl">
            <PageHeader title={title} accent={accent} lead={lead} />

            {loading ? (
                <div className="text-center font-body font-semibold text-usb-muted py-20 animate-pulse">
                    Loading...
                </div>
            ) : items.length === 0 ? (
                <div className="font-body text-lg text-usb-charcoal text-center leading-relaxed py-20">
                    {emptyMessage}
                </div>
            ) : (
                <div className="space-y-8">
                    {items.map((item, index) => (
                        <ItemCard key={item.name ?? index} item={item} index={index} />
                    ))}
                </div>
            )}
        </PageShell>
    );
}
