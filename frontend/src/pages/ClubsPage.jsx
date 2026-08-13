import DirectoryPage from '../components/DirectoryPage.jsx';

export default function ClubsPage() {
    return (
        <DirectoryPage
            title="Purdue Technical"
            accent="Clubs"
            lead="Discover the clubs and organizations building things at Purdue. Join a community that shares what you're interested in - most of them are always looking for new members."
            source="/Clubs.json"
            dataKey="clubs"
            emptyMessage="No clubs listed yet. Check back soon."
        />
    );
}
