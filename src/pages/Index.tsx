import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Gender, Match, Player } from "@/types";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { PlayerRankings } from "@/components/PlayerRankings";
import { MatchDisplay } from "@/components/MatchDisplay";
import { FinalMatch } from "@/components/FinalMatch";

const initialFemalePlayers: Player[] = [
  { name: "Lakota", points: 0, totalScores: 0 },
  { name: "Lidia", points: 0, totalScores: 0 },
  { name: "Giulia", points: 0, totalScores: 0 },
  { name: "Dina", points: 0, totalScores: 0 },
  { name: "Catalina", points: 0, totalScores: 0 },
  { name: "Izel", points: 0, totalScores: 0 },
  { name: "Marta", points: 0, totalScores: 0 },
  { name: "Eli", points: 0, totalScores: 0 },
];

const initialMalePlayers: Player[] = [
  { name: "Giacomo", points: 0, totalScores: 0 },
  { name: "David", points: 0, totalScores: 0 },
  { name: "Javi", points: 0, totalScores: 0 },
  { name: "Mauro", points: 0, totalScores: 0 },
  { name: "Mattia", points: 0, totalScores: 0 },
  { name: "Dani", points: 0, totalScores: 0 },
  { name: "Leo", points: 0, totalScores: 0 },
  { name: "Samuel", points: 0, totalScores: 0 },
]

const initialFemaleMatches: Match[] = [
  { player1: initialFemalePlayers[0], player2: initialFemalePlayers[1], player3: initialFemalePlayers[2], player4: initialFemalePlayers[3], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[4], player2: initialFemalePlayers[5], player3: initialFemalePlayers[6], player4: initialFemalePlayers[7], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[5], player2: initialFemalePlayers[6], player3: initialFemalePlayers[7], player4: initialFemalePlayers[0], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[3], player2: initialFemalePlayers[4], player3: initialFemalePlayers[1], player4: initialFemalePlayers[2], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[6], player2: initialFemalePlayers[3], player3: initialFemalePlayers[4], player4: initialFemalePlayers[1], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[0], player2: initialFemalePlayers[2], player3: initialFemalePlayers[7], player4: initialFemalePlayers[5], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[2], player2: initialFemalePlayers[4], player3: initialFemalePlayers[3], player4: initialFemalePlayers[7], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[1], player2: initialFemalePlayers[6], player3: initialFemalePlayers[5], player4: initialFemalePlayers[0], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[5], player2: initialFemalePlayers[3], player3: initialFemalePlayers[6], player4: initialFemalePlayers[2], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[7], player2: initialFemalePlayers[1], player3: initialFemalePlayers[0], player4: initialFemalePlayers[4], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[2], player2: initialFemalePlayers[7], player3: initialFemalePlayers[1], player4: initialFemalePlayers[5], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[3], player2: initialFemalePlayers[0], player3: initialFemalePlayers[4], player4: initialFemalePlayers[6], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[7], player2: initialFemalePlayers[4], player3: initialFemalePlayers[0], player4: initialFemalePlayers[6], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialFemalePlayers[5], player2: initialFemalePlayers[2], player3: initialFemalePlayers[6], player4: initialFemalePlayers[1], score1: 0, score2: 0, isSubmitted: false },
]

const initialMaleMatches: Match[] = [
  { player1: initialMalePlayers[0], player2: initialMalePlayers[1], player3: initialMalePlayers[2], player4: initialMalePlayers[3], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[4], player2: initialMalePlayers[5], player3: initialMalePlayers[6], player4: initialMalePlayers[7], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[5], player2: initialMalePlayers[6], player3: initialMalePlayers[7], player4: initialMalePlayers[0], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[3], player2: initialMalePlayers[4], player3: initialMalePlayers[1], player4: initialMalePlayers[2], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[6], player2: initialMalePlayers[3], player3: initialMalePlayers[4], player4: initialMalePlayers[1], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[0], player2: initialMalePlayers[2], player3: initialMalePlayers[7], player4: initialMalePlayers[5], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[2], player2: initialMalePlayers[4], player3: initialMalePlayers[3], player4: initialMalePlayers[7], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[1], player2: initialMalePlayers[6], player3: initialMalePlayers[5], player4: initialMalePlayers[0], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[5], player2: initialMalePlayers[3], player3: initialMalePlayers[6], player4: initialMalePlayers[2], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[7], player2: initialMalePlayers[1], player3: initialMalePlayers[0], player4: initialMalePlayers[4], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[2], player2: initialMalePlayers[7], player3: initialMalePlayers[1], player4: initialMalePlayers[5], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[3], player2: initialMalePlayers[0], player3: initialMalePlayers[4], player4: initialMalePlayers[6], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[7], player2: initialMalePlayers[4], player3: initialMalePlayers[0], player4: initialMalePlayers[6], score1: 0, score2: 0, isSubmitted: false },
  { player1: initialMalePlayers[5], player2: initialMalePlayers[2], player3: initialMalePlayers[6], player4: initialMalePlayers[1], score1: 0, score2: 0, isSubmitted: false },
]

export default function BeachVolleyballTracker() {
  const [gender, setGender] = useState<Gender>("female");
  const [femalePlayers, setFemalePlayers] = useState<Player[]>(initialFemalePlayers);
  const [malePlayers, setMalePlayers] = useState<Player[]>(initialMalePlayers);
  const [femaleMatches, setFemaleMatches] = useState<Match[]>(initialFemaleMatches);
  const [maleMatches, setMaleMatches] = useState<Match[]>(initialMaleMatches);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [score1, setScore1] = useState("");
  const [score2, setScore2] = useState("");
  const [finalMatchScores, setFinalMatchScores] = useState<FinalMatchScores>({
    team1: [null, null, null],
    team2: [null, null, null],
  });
  const [finalMatchSubmitted, setFinalMatchSubmitted] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showFinalMatch, setShowFinalMatch] = useState(false);
  const [isEditingFinalMatch, setIsEditingFinalMatch] = useState(false);
  const [finalMatchWinner, setFinalMatchWinner] = useState<FinalMatchWinner>(null);
  const [selectedPlayerToReplace, setSelectedPlayerToReplace] = useState<Player | null>(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerGender, setNewPlayerGender] = useState<Gender>("female");

  const players = gender === 'female' ? femalePlayers : malePlayers
  const matches = gender === 'female' ? femaleMatches : maleMatches
  const setMatches = gender === 'female' ? setFemaleMatches : setMaleMatches
  const setPlayers = gender === 'female' ? setFemalePlayers : setMalePlayers

  const topPlayers = players.slice(0, 2).sort((a, b) => {
    if (b.points === a.points) {
      return b.totalScores - a.totalScores;
    }
    return b.points - a.points;
  });

  const handleScoreSubmit = () => {
    const newMatches = [...matches]
    newMatches[currentMatchIndex] = {
      ...newMatches[currentMatchIndex],
      score1: parseInt(score1, 10) || 0,
      score2: parseInt(score2, 10) || 0,
      isSubmitted: true,
    }
    setMatches(newMatches)
    updatePlayerPoints(newMatches[currentMatchIndex])
    setScore1('')
    setScore2('')
  }

  const updatePlayerPoints = (match: Match) => {
    const { player1, player2, player3, player4, score1, score2 } = match
    const newPlayers = [...players]
    const player1Index = newPlayers.findIndex(p => p.name === player1.name)
    const player2Index = newPlayers.findIndex(p => p.name === player2.name)
    const player3Index = newPlayers.findIndex(p => p.name === player3.name)
    const player4Index = newPlayers.findIndex(p => p.name === player4.name)

    if (score1 > score2) {
      newPlayers[player1Index].points += 2
      newPlayers[player2Index].points += 2
      newPlayers[player3Index].points += 1
      newPlayers[player4Index].points += 1
    } else {
      newPlayers[player1Index].points += 1
      newPlayers[player2Index].points += 1
      newPlayers[player3Index].points += 2
      newPlayers[player4Index].points += 2
    }

    newPlayers[player1Index].totalScores += score1
    newPlayers[player2Index].totalScores += score1
    newPlayers[player3Index].totalScores += score2
    newPlayers[player4Index].totalScores += score2

    setPlayers(newPlayers.sort((a, b) => {
      if (b.points === a.points) {
        return b.totalScores - a.totalScores;
      }
      return b.points - a.points;
    }))
  }

  const handleAdminLogin = () => {
    if (adminUsername === 'leo' && adminPassword === 'Woodgoat22!!') {
      setIsAdmin(true)
      setShowLoginForm(false)
    } else {
      alert('Invalid username or password')
    }
  }

  const handleAdminLogout = () => {
    setIsAdmin(false)
  }

  const handleResetScores = () => {
    const newFemalePlayers = femalePlayers.map(player => ({ ...player, points: 0, totalScores: 0 }))
    setFemalePlayers(newFemalePlayers)
    const newMalePlayers = malePlayers.map(player => ({ ...player, points: 0, totalScores: 0 }))
    setMalePlayers(newMalePlayers)
    const newFemaleMatches = femaleMatches.map(match => ({ ...match, score1: 0, score2: 0, isSubmitted: false }))
    setFemaleMatches(newFemaleMatches)
    const newMaleMatches = maleMatches.map(match => ({ ...match, score1: 0, score2: 0, isSubmitted: false }))
    setMaleMatches(newMaleMatches)
  }

  const handleEditScore = (matchIndex: number, newScore1: number, newScore2: number) => {
    const newMatches = [...matches]
    const oldMatch = newMatches[matchIndex]
    newMatches[matchIndex] = {
      ...newMatches[matchIndex],
      score1: newScore1,
      score2: newScore2,
      isSubmitted: true,
    }

    // Reset points for the old match
    const oldPlayers = [...players]
    const oldPlayer1Index = oldPlayers.findIndex(p => p.name === oldMatch.player1.name)
    const oldPlayer2Index = oldPlayers.findIndex(p => p.name === oldMatch.player2.name)
    const oldPlayer3Index = oldPlayers.findIndex(p => p.name === oldMatch.player3.name)
    const oldPlayer4Index = oldPlayers.findIndex(p => p.name === oldMatch.player4.name)

    oldPlayers[oldPlayer1Index].points -= oldMatch.score1 > oldMatch.score2 ? 2 : 1
    oldPlayers[oldPlayer2Index].points -= oldMatch.score1 > oldMatch.score2 ? 2 : 1
    oldPlayers[oldPlayer3Index].points -= oldMatch.score1 > oldMatch.score2 ? 1 : 2
    oldPlayers[oldPlayer4Index].points -= oldMatch.score1 > oldMatch.score2 ? 1 : 2

    oldPlayers[oldPlayer1Index].totalScores -= oldMatch.score1
    oldPlayers[oldPlayer2Index].totalScores -= oldMatch.score1
    oldPlayers[oldPlayer3Index].totalScores -= oldMatch.score2
    oldPlayers[oldPlayer4Index].totalScores -= oldMatch.score2

    // Update points for the new match
    updatePlayerPoints(newMatches[matchIndex])

    setMatches(newMatches)
    setPlayers(oldPlayers.sort((a, b) => {
      if (b.points === a.points) {
        return b.totalScores - a.totalScores;
      }
      return b.points - a.points;
    }))
  }

  const handleFinalMatchSubmit = () => {
    const team1Scores = finalMatchScores.team1.filter(score => score !== null) as number[]
    const team2Scores = finalMatchScores.team2.filter(score => score !== null) as number[]

    const team1Wins = team1Scores.filter((score, index) => score > (team2Scores[index] || 0)).length
    const team2Wins = team2Scores.filter((score, index) => score > (team1Scores[index] || 0)).length

    if (team1Wins > team2Wins) {
      setFinalMatchWinner({
        team: 'team1',
        malePlayer: malePlayers[0].name,
        femalePlayer: femalePlayers[1].name,
        losingMalePlayer: malePlayers[1].name,
        losingFemalePlayer: femalePlayers[0].name,
      })
    } else if (team2Wins > team1Wins) {
      setFinalMatchWinner({
        team: 'team2',
        malePlayer: malePlayers[1].name,
        femalePlayer: femalePlayers[0].name,
        losingMalePlayer: malePlayers[0].name,
        losingFemalePlayer: femalePlayers[1].name,
      })
    } else {
      setFinalMatchWinner(null)
    }

    setFinalMatchSubmitted(true)
  }

  const handleEditFinalMatch = () => {
    setIsEditingFinalMatch(true)
  }

  const handleFinalMatchEditSubmit = () => {
    setIsEditingFinalMatch(false)
  }

  const handleResetFinalMatch = () => {
    setFinalMatchScores({ team1: [null, null, null], team2: [null, null, null] })
    setFinalMatchSubmitted(false)
    setFinalMatchWinner(null)
  }

  const handleReplacePlayer = () => {
    if (!selectedPlayerToReplace || !newPlayerName) {
      alert('Please select a player to replace and enter a new player name.')
      return
    }

    const newPlayer: Player = {
      name: newPlayerName,
      points: selectedPlayerToReplace.points,
      totalScores: selectedPlayerToReplace.totalScores,
    }

    const newPlayers = players.map(player => (player.name === selectedPlayerToReplace.name ? newPlayer : player))
    setPlayers(newPlayers)

    const newMatches = matches.map(match => {
      if (match.player1.name === selectedPlayerToReplace.name) {
        return { ...match, player1: newPlayer }
      }
      if (match.player2.name === selectedPlayerToReplace.name) {
        return { ...match, player2: newPlayer }
      }
      if (match.player3.name === selectedPlayerToReplace.name) {
        return { ...match, player3: newPlayer }
      }
      if (match.player4.name === selectedPlayerToReplace.name) {
        return { ...match, player4: newPlayer }
      }
      return match
    })
    setMatches(newMatches)

    if (newPlayerGender === 'female') {
      setFemalePlayers(newPlayers)
      setFemaleMatches(newMatches)
    } else {
      setMalePlayers(newPlayers)
      setMaleMatches(newMatches)
    }

    setSelectedPlayerToReplace(null)
    setNewPlayerName('')
    setNewPlayerGender('female')
  }

  const currentMatch = matches[currentMatchIndex]

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-4">
      <style>
        {`
          input[type="number"]::-webkit-inner-spin-button,
          input[type="number"]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type="number"] {
            -moz-appearance: textfield;
          }
        `}
      </style>
      <header className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => { setGender('female'); setShowFinalMatch(false); }}>
            Female
          </Button>
          <Button variant="outline" onClick={() => { setGender('male'); setShowFinalMatch(false); }}>
            Male
          </Button>
          <Button variant="outline" onClick={() => setShowFinalMatch(true)}>
            Final Match
          </Button>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => setShowLoginForm(true)}>
            Admin Login
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={handleAdminLogout}>
              Admin Logout
            </Button>
          )}
        </div>
      </header>

      {showLoginForm && (
        <AdminLoginForm
          adminUsername={adminUsername}
          adminPassword={adminPassword}
          onUsernameChange={setAdminUsername}
          onPasswordChange={setAdminPassword}
          onLogin={handleAdminLogin}
        />
      )}

      {!showLoginForm && (
        <main className="w-full max-w-4xl">
          {showFinalMatch ? (
            <FinalMatch
              finalMatchScores={finalMatchScores}
              finalMatchSubmitted={finalMatchSubmitted}
              isEditingFinalMatch={isEditingFinalMatch}
              isAdmin={isAdmin}
              malePlayers={malePlayers}
              femalePlayers={femalePlayers}
              finalMatchWinner={finalMatchWinner}
              onScoresChange={setFinalMatchScores}
              onSubmit={handleFinalMatchSubmit}
              onEdit={handleEditFinalMatch}
              onEditSubmit={handleFinalMatchEditSubmit}
              onReset={handleResetFinalMatch}
            />
          ) : (
            <>
              <section className="mb-8">
                <PlayerRankings players={players} gender={gender} />
              </section>
              <section className="mb-8">
                <MatchDisplay
                  match={currentMatch}
                  matchIndex={currentMatchIndex}
                  score1={score1}
                  score2={score2}
                  isAdmin={isAdmin}
                  onScore1Change={setScore1}
                  onScore2Change={setScore2}
                  onSubmit={handleScoreSubmit}
                  onEdit={handleEditScore}
                />
              </section>
            </>
          )}
        </main>
      )}
    </div>
  );
}
