(() => {
    if (window.__cardGameGuideLoaded) {
        return;
    }

    window.__cardGameGuideLoaded = true;

    const currentFile =
        window.location.pathname.split("/").pop()
        || "index.html";

    const supportedFiles = new Set([
        "poker.html",
        "poker-table.html",
        "five-card-draw-table.html",
        "blackjack-table.html",
        "hearts-table.html",
        "solitaire-table.html"
    ]);

    if (!supportedFiles.has(currentFile)) {
        return;
    }

    const pokerRankingHtml = `
        <div class="card-guide-table-wrap">
            <table class="card-guide-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Hand</th>
                        <th>Meaning</th>
                        <th>Main tie-break</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1</td>
                        <td>Royal flush</td>
                        <td>A, K, Q, J and 10 of one suit.</td>
                        <td>Always tied when the same five board cards play.</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>Straight flush</td>
                        <td>Five consecutive cards of one suit.</td>
                        <td>Highest card in the straight.</td>
                    </tr>
                    <tr>
                        <td>3</td>
                        <td>Four of a kind</td>
                        <td>Four cards of one rank.</td>
                        <td>Quad rank, then the kicker.</td>
                    </tr>
                    <tr>
                        <td>4</td>
                        <td>Full house</td>
                        <td>Three of one rank and two of another.</td>
                        <td>Trip rank, then pair rank.</td>
                    </tr>
                    <tr>
                        <td>5</td>
                        <td>Flush</td>
                        <td>Five cards of one suit, not consecutive.</td>
                        <td>Compare cards from highest downward.</td>
                    </tr>
                    <tr>
                        <td>6</td>
                        <td>Straight</td>
                        <td>Five consecutive ranks in mixed suits.</td>
                        <td>Highest card. A-2-3-4-5 counts as five-high.</td>
                    </tr>
                    <tr>
                        <td>7</td>
                        <td>Three of a kind</td>
                        <td>Three cards of one rank.</td>
                        <td>Trip rank, then both kickers.</td>
                    </tr>
                    <tr>
                        <td>8</td>
                        <td>Two pair</td>
                        <td>Two different pairs.</td>
                        <td>Higher pair, lower pair, then kicker.</td>
                    </tr>
                    <tr>
                        <td>9</td>
                        <td>One pair</td>
                        <td>Two cards of one rank.</td>
                        <td>Pair rank, then kickers from highest downward.</td>
                    </tr>
                    <tr>
                        <td>10</td>
                        <td>High card</td>
                        <td>No stronger five-card combination.</td>
                        <td>Compare the five cards from highest downward.</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p>
            Suits do not break ties. When every relevant rank and kicker is
            equal, the pot is tied. In Hold'em, remember that the board itself
            may be the best five-card hand for everyone.
        </p>
    `;

    const guides = {
        texas_holdem: {
            label: "Texas Hold'em",
            title: "How to Play Texas Hold'em",
            summary:
                "Make the strongest five-card poker hand from your two private cards and the five shared community cards, or win earlier by making every opponent fold.",
            facts: [
                "2 to 9 players",
                "Two private hole cards",
                "Five shared community cards",
                "Four betting rounds"
            ],
            sections: [
                {
                    title: "1. The objective and table setup",
                    html: `
                        <p>
                            Every player receives two private hole cards. Five
                            community cards are eventually dealt face-up in the
                            centre of the table. Your final hand is the best
                            possible five-card combination made from any mixture
                            of your hole cards and the community cards.
                        </p>
                        <p>
                            You are not required to use both hole cards. You may
                            use two, one, or none of them. For example, when the
                            board contains the best possible straight, everyone
                            still in the hand may be playing that same straight.
                        </p>
                        <ul>
                            <li>
                                The dealer button marks the nominal dealer and
                                moves clockwise after each hand.
                            </li>
                            <li>
                                The player left of the dealer posts the small
                                blind; the next player posts the big blind.
                            </li>
                            <li>
                                Blinds create a pot before anyone sees the flop,
                                so there is always something worth competing for.
                            </li>
                            <li>
                                Your table stack is separate from your wallet.
                                Only chips currently at the table can be wagered.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "2. The four betting rounds",
                    html: `
                        <ol>
                            <li>
                                <strong>Preflop:</strong> each player has two hole
                                cards. Action begins left of the big blind. The
                                big blind may check when nobody has raised.
                            </li>
                            <li>
                                <strong>Flop:</strong> three community cards are
                                dealt together. Action begins with the first live
                                player clockwise from the dealer.
                            </li>
                            <li>
                                <strong>Turn:</strong> a fourth community card is
                                dealt, followed by another betting round.
                            </li>
                            <li>
                                <strong>River:</strong> the fifth and final
                                community card is dealt, followed by the last
                                betting round.
                            </li>
                        </ol>
                        <p>
                            If two or more players remain after the river, the
                            hand reaches showdown and the strongest five-card
                            poker hand wins. If every opponent folds earlier,
                            the last remaining player wins without needing to
                            reveal a stronger hand.
                        </p>
                    `
                },
                {
                    title: "3. What every action means",
                    html: `
                        <ul>
                            <li>
                                <strong>Fold:</strong> surrender the hand and any
                                chips already committed to the pot.
                            </li>
                            <li>
                                <strong>Check:</strong> pass the action without
                                betting. This is legal only when you do not owe
                                chips to match the current bet.
                            </li>
                            <li>
                                <strong>Call:</strong> match the amount required
                                to remain in the hand.
                            </li>
                            <li>
                                <strong>Bet:</strong> place the first wager of a
                                betting round.
                            </li>
                            <li>
                                <strong>Raise:</strong> increase an existing bet.
                                Other active players must respond by folding,
                                calling, or raising again.
                            </li>
                            <li>
                                <strong>All in:</strong> commit your entire
                                remaining table stack. You cannot take further
                                betting actions in that hand.
                            </li>
                        </ul>
                        <p>
                            The site's <strong>Total bet</strong> field is the
                            total amount you want committed on the current
                            street, not merely the extra chips being added.
                            Check the current-bet label before submitting a
                            raise, because humans apparently enjoy making
                            arithmetic part of a card game.
                        </p>
                    `
                },
                {
                    title: "4. Poker hand rankings",
                    html: pokerRankingHtml
                },
                {
                    title: "5. Position, information and basic strategy",
                    html: `
                        <p>
                            Acting later is valuable because you see more
                            opponents make decisions before you. Early-position
                            players should generally require stronger starting
                            hands, while late-position players can enter more
                            pots and apply pressure more safely.
                        </p>
                        <ul>
                            <li>
                                Strong starting hands include high pairs, high
                                connected cards and suited high cards.
                            </li>
                            <li>
                                Avoid calling large bets with weak, disconnected
                                cards merely because they are technically cards.
                            </li>
                            <li>
                                Compare the price of a call with the chance of
                                improving. A draw becomes less attractive when
                                the call is large relative to the pot.
                            </li>
                            <li>
                                Betting can win value from weaker hands, protect
                                vulnerable made hands, or make better hands fold.
                            </li>
                            <li>
                                Bluff less often against several opponents.
                                Someone usually has enough of a hand to become
                                emotionally attached to it.
                            </li>
                            <li>
                                Watch stack sizes. A short stack has fewer
                                future decisions and may be forced toward an
                                all-in choice.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "6. Using this table",
                    html: `
                        <ul>
                            <li>
                                The host starts a hand once enough active players
                                are seated.
                            </li>
                            <li>
                                Players joining during a hand enter the next-hand
                                queue rather than appearing in the middle of a
                                deal.
                            </li>
                            <li>
                                <strong>Hide cards</strong> covers your private
                                cards without changing the game state.
                            </li>
                            <li>
                                The hand history records blinds, bets, calls,
                                folds and raises.
                            </li>
                            <li>
                                <strong>Repair table</strong> is for a genuinely
                                stuck table, not for repairing a strategic
                                decision immediately after making it.
                            </li>
                            <li>
                                Tables containing bots are Friendly practice
                                tables. Practice chips do not create wallet
                                profit, XP, achievements, challenge progress,
                                competitive statistics or club progress.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "7. Common mistakes",
                    html: `
                        <ul>
                            <li>
                                Using all seven available cards instead of
                                selecting the best five.
                            </li>
                            <li>
                                Forgetting that a flush beats a straight.
                            </li>
                            <li>
                                Calling because you have already invested chips.
                                Chips already in the pot are gone unless you win.
                            </li>
                            <li>
                                Treating one pair as unbeatable on a coordinated
                                board containing obvious straight and flush
                                possibilities.
                            </li>
                            <li>
                                Raising without leaving opponents any weaker
                                hands that could reasonably call.
                            </li>
                        </ul>
                    `
                }
            ]
        },

        five_card_draw: {
            label: "Five-Card Draw",
            title: "How to Play Five-Card Draw",
            summary:
                "Build the strongest private five-card poker hand through one draw and two betting rounds. Unlike Hold'em, there are no community cards.",
            facts: [
                "2 to 6 players",
                "Five private cards",
                "Discard up to three",
                "Two betting rounds"
            ],
            sections: [
                {
                    title: "1. Objective and setup",
                    html: `
                        <p>
                            Each player receives five private cards. Your goal is
                            to finish with the highest-ranking five-card poker
                            hand, or to win the pot before showdown by making
                            every opponent fold.
                        </p>
                        <p>
                            The dealer button and blinds operate much like
                            Hold'em. The small blind and big blind create the
                            opening pot, then action proceeds clockwise.
                            Because no cards are shared, the information you gain
                            from betting and the number of cards each opponent
                            draws matters far more.
                        </p>
                    `
                },
                {
                    title: "2. Complete hand sequence",
                    html: `
                        <ol>
                            <li>
                                <strong>Deal:</strong> every active player
                                receives five private cards.
                            </li>
                            <li>
                                <strong>Pre-draw betting:</strong> players fold,
                                call, bet, raise or move all in.
                            </li>
                            <li>
                                <strong>Draw:</strong> each remaining player may
                                discard zero to three cards and receive the same
                                number of replacements.
                            </li>
                            <li>
                                <strong>Post-draw betting:</strong> a second and
                                final betting round takes place.
                            </li>
                            <li>
                                <strong>Showdown:</strong> remaining players are
                                compared using standard poker rankings.
                            </li>
                        </ol>
                        <p>
                            A player who keeps all five original cards
                            <strong>stands pat</strong>. This often represents a
                            made hand, although it can also represent someone
                            attempting theatre with an alarming commitment to
                            the role.
                        </p>
                    `
                },
                {
                    title: "3. Drawing cards correctly",
                    html: `
                        <p>
                            During the draw phase, select the cards you want to
                            discard. The site permits up to three replacements.
                            Leaving every card unselected submits a stand-pat
                            action.
                        </p>
                        <ul>
                            <li>
                                With one pair, a common play is to keep the pair
                                and draw three.
                            </li>
                            <li>
                                With two pair, keep both pairs and draw one.
                            </li>
                            <li>
                                With three of a kind, keep the three matching
                                cards and usually draw two.
                            </li>
                            <li>
                                With four cards to a flush or an open-ended
                                straight, drawing one may be worthwhile.
                            </li>
                            <li>
                                Breaking a made straight or flush is almost
                                always a generous donation to the table.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "4. Betting actions and reading opponents",
                    html: `
                        <p>
                            Fold, check, call, bet, raise and all-in work the same
                            way as in Hold'em. The <strong>Total bet</strong>
                            field describes the total amount committed during
                            the current betting round.
                        </p>
                        <p>
                            Draw counts provide clues:
                        </p>
                        <ul>
                            <li>
                                Drawing three commonly indicates a pair or a
                                weak hand being rebuilt.
                            </li>
                            <li>
                                Drawing two often indicates three of a kind, but
                                it can also conceal other plans.
                            </li>
                            <li>
                                Drawing one often represents two pair, a
                                four-card straight draw or a four-card flush.
                            </li>
                            <li>
                                Standing pat usually signals a straight or
                                better, but the signal is not a signed legal
                                statement.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "5. Poker hand rankings",
                    html: pokerRankingHtml
                },
                {
                    title: "6. Practical strategy",
                    html: `
                        <ul>
                            <li>
                                Value made hands aggressively. There is only one
                                draw, so opponents have fewer chances to catch up.
                            </li>
                            <li>
                                Do not chase weak inside-straight draws for large
                                bets.
                            </li>
                            <li>
                                Pay attention to how the betting changed after
                                the draw. A quiet player who drew one and now
                                raises may have improved.
                            </li>
                            <li>
                                Bluffing after standing pat can be effective, but
                                repeated use becomes less mysterious rather
                                quickly.
                            </li>
                            <li>
                                In multiway pots, require stronger hands because
                                more opponents have a chance to finish with a
                                serious made hand.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "7. Using this table",
                    html: `
                        <ul>
                            <li>
                                Click cards during the draw phase to mark them
                                for replacement.
                            </li>
                            <li>
                                The draw button changes between
                                <strong>Stand pat</strong> and the number of
                                replacement cards selected.
                            </li>
                            <li>
                                The host begins each hand; players joining an
                                active hand wait in the next-hand queue.
                            </li>
                            <li>
                                Bot tables use Friendly practice stacks and do
                                not award competitive progression or wallet
                                profit.
                            </li>
                        </ul>
                    `
                }
            ]
        },

        blackjack: {
            label: "Blackjack",
            title: "How to Play Multiplayer Blackjack",
            summary:
                "Each player competes against the dealer, not against the other players. Finish closer to 21 than the dealer without going over 21.",
            facts: [
                "1 to 7 players",
                "Dealer stands on all 17",
                "Blackjack pays 3:2 profit",
                "No splitting or insurance"
            ],
            sections: [
                {
                    title: "1. Objective and card values",
                    html: `
                        <p>
                            Your hand must beat the dealer's hand without
                            exceeding 21. A hand above 21 is a bust and loses
                            immediately.
                        </p>
                        <ul>
                            <li>Cards 2 through 9 are worth their face value.</li>
                            <li>10, Jack, Queen and King are each worth 10.</li>
                            <li>
                                An Ace is worth 11 when possible, but changes to
                                1 when counting it as 11 would make the hand bust.
                            </li>
                        </ul>
                        <p>
                            A hand containing an Ace currently counted as 11 is
                            called <strong>soft</strong>. A hand with no such Ace
                            is <strong>hard</strong>. Soft hands can often take
                            another card more safely because the Ace can fall
                            from 11 to 1.
                        </p>
                    `
                },
                {
                    title: "2. Betting and starting a round",
                    html: `
                        <ol>
                            <li>
                                Choose a next-round bet within the displayed
                                table limits.
                            </li>
                            <li>
                                Use <strong>Set bet</strong> to reserve that
                                amount from your table stack.
                            </li>
                            <li>
                                Use <strong>Sit out</strong> when you do not want
                                to enter the next round.
                            </li>
                            <li>
                                Once participating players are ready, the host
                                selects <strong>Deal round</strong>.
                            </li>
                            <li>
                                Each participating player and the dealer receive
                                two cards. Players take turns before the dealer
                                completes the dealer hand.
                            </li>
                        </ol>
                        <p>
                            Players joining during an active round wait for the
                            next round. Each player's result is calculated
                            separately against the same dealer total.
                        </p>
                    `
                },
                {
                    title: "3. Available actions",
                    html: `
                        <ul>
                            <li>
                                <strong>Hit:</strong> receive another card. If the
                                total exceeds 21, the hand busts immediately. A
                                total of exactly 21 automatically stands.
                            </li>
                            <li>
                                <strong>Stand:</strong> take no more cards and
                                keep the current total.
                            </li>
                            <li>
                                <strong>Double:</strong> available only on the
                                original two-card hand when your table stack can
                                cover an additional bet equal to the first one.
                                Your bet doubles, you receive exactly one more
                                card, then automatically stand.
                            </li>
                        </ul>
                        <p>
                            This version does not include splitting pairs,
                            insurance or surrender. Their absence saves the
                            interface from becoming a cockpit and also means
                            strategies involving those actions do not apply.
                        </p>
                    `
                },
                {
                    title: "4. Dealer rules and round resolution",
                    html: `
                        <p>
                            After all participating players finish, the dealer
                            draws while below 17 and stands on every total of 17
                            or higher, including soft 17.
                        </p>
                        <ul>
                            <li>
                                A player bust always loses, even when the dealer
                                later busts.
                            </li>
                            <li>
                                A dealer bust pays every non-busted player as a
                                normal win.
                            </li>
                            <li>
                                A higher non-busted total wins.
                            </li>
                            <li>
                                Equal totals produce a push and return the bet.
                            </li>
                            <li>
                                A two-card 21 is a natural blackjack and beats a
                                dealer total of 21 made with three or more cards.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "5. Payouts",
                    html: `
                        <ul>
                            <li>
                                <strong>Normal win:</strong> 1:1 profit. The
                                returned amount is twice the bet because it
                                includes the original stake.
                            </li>
                            <li>
                                <strong>Natural blackjack:</strong> 3:2 profit.
                                The returned amount is two and a half times the
                                bet, rounded down to a whole chip where needed.
                            </li>
                            <li>
                                <strong>Push:</strong> the original bet is
                                returned with no profit.
                            </li>
                            <li>
                                <strong>Loss or bust:</strong> no payout is
                                returned.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "6. Strategy principles",
                    html: `
                        <ul>
                            <li>
                                Hard totals of 17 or more should normally stand.
                            </li>
                            <li>
                                Very low hard totals usually need another card.
                            </li>
                            <li>
                                Dealer cards from 2 through 6 are comparatively
                                weak because the dealer is forced to draw and may
                                bust.
                            </li>
                            <li>
                                Dealer cards from 7 through Ace are stronger, so
                                passive totals often need improvement.
                            </li>
                            <li>
                                Doubling is most useful when one card is likely
                                to create a strong total, especially from totals
                                near 9, 10 or 11.
                            </li>
                            <li>
                                Soft hands can be played more aggressively
                                because an Ace can change value.
                            </li>
                        </ul>
                        <p>
                            Strategy reduces the house edge; it does not make the
                            next card obey a spreadsheet.
                        </p>
                    `
                },
                {
                    title: "7. Using this table",
                    html: `
                        <ul>
                            <li>
                                Your selected bet is for the next round, not an
                                action during the current turn.
                            </li>
                            <li>
                                The active-turn highlight identifies the only
                                player who can currently hit, stand or double.
                            </li>
                            <li>
                                The dealer result and every player's result are
                                displayed after the round completes.
                            </li>
                            <li>
                                Bot tables use Friendly practice stacks and
                                award no wallet profit or competitive progress.
                            </li>
                        </ul>
                    `
                }
            ]
        },

        hearts: {
            label: "Hearts",
            title: "How to Play Hearts",
            summary:
                "Avoid collecting point cards. Every Heart is worth one point and the Queen of Spades is worth thirteen. The lowest total score wins.",
            facts: [
                "Exactly 4 players",
                "13 cards each",
                "26 points per hand",
                "Default target: 100"
            ],
            sections: [
                {
                    title: "1. Objective and scoring",
                    html: `
                        <p>
                            Hearts is a trick-taking game in which points are
                            undesirable. A complete hand contains 13 tricks and
                            exactly 26 available penalty points.
                        </p>
                        <ul>
                            <li>Each Heart captured is worth 1 point.</li>
                            <li>The Queen of Spades is worth 13 points.</li>
                            <li>All other cards are worth 0 points.</li>
                        </ul>
                        <p>
                            Scores accumulate across hands. Once at least one
                            player reaches the target score, normally 100, the
                            player with the lowest total wins the match.
                        </p>
                    `
                },
                {
                    title: "2. Dealing and passing",
                    html: `
                        <p>
                            Four players receive 13 cards each. Before most
                            hands, every player selects exactly three cards and
                            passes them simultaneously.
                        </p>
                        <ol>
                            <li>First passing hand: pass left.</li>
                            <li>Second passing hand: pass right.</li>
                            <li>Third passing hand: pass across.</li>
                            <li>Fourth hand: hold; no cards are passed.</li>
                        </ol>
                        <p>
                            The cycle then repeats. Passed cards are locked until
                            all four players submit, so you cannot alter your
                            selection after discovering that everyone else also
                            had plans.
                        </p>
                    `
                },
                {
                    title: "3. Playing a trick",
                    html: `
                        <ol>
                            <li>
                                The player holding the 2 of Clubs leads the first
                                trick and must play that card.
                            </li>
                            <li>
                                Each other player must follow the led suit when
                                holding at least one card of that suit.
                            </li>
                            <li>
                                A player unable to follow suit may discard a card
                                from another suit, subject to the first-trick
                                restrictions.
                            </li>
                            <li>
                                The highest card of the led suit wins the trick.
                                Cards from other suits cannot win it.
                            </li>
                            <li>
                                The winner collects the trick's points and leads
                                the next trick.
                            </li>
                        </ol>
                    `
                },
                {
                    title: "4. Hearts broken and first-trick restrictions",
                    html: `
                        <ul>
                            <li>
                                You cannot lead a Heart until Hearts have been
                                broken, unless your hand contains only Hearts.
                            </li>
                            <li>
                                Hearts become broken when any Heart is discarded
                                onto a trick led in another suit.
                            </li>
                            <li>
                                On the first trick, you cannot discard a Heart or
                                the Queen of Spades while holding any non-point
                                alternative.
                            </li>
                            <li>
                                Following suit is mandatory even when doing so
                                forces you to play a high card.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "5. Shooting the moon",
                    html: `
                        <p>
                            A player who captures all 13 Hearts and the Queen of
                            Spades has taken all 26 points and
                            <strong>shoots the moon</strong>. In this version,
                            that player receives 0 points while every opponent
                            receives 26.
                        </p>
                        <p>
                            A moon attempt usually requires strong control of
                            several suits. Half-committing is dangerous: taking
                            most of the point cards without completing the moon
                            simply produces a very large personal score.
                        </p>
                    `
                },
                {
                    title: "6. Passing and play strategy",
                    html: `
                        <ul>
                            <li>
                                Passing the Queen of Spades can remove a major
                                danger, but keeping it may be reasonable when
                                protected by several low Spades.
                            </li>
                            <li>
                                Shortening a suit gives you earlier opportunities
                                to discard dangerous cards when that suit is led.
                            </li>
                            <li>
                                Low cards are valuable because they help avoid
                                winning tricks.
                            </li>
                            <li>
                                Track whether high danger cards such as the Ace
                                and King of Spades have already appeared.
                            </li>
                            <li>
                                Avoid leading suits in which only your high cards
                                remain.
                            </li>
                            <li>
                                Watch for a possible moon attempt when one player
                                keeps winning point-heavy tricks.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "7. Using this table",
                    html: `
                        <ul>
                            <li>
                                During passing, select exactly three cards and
                                confirm with <strong>Pass 3 cards</strong>.
                            </li>
                            <li>
                                During your turn, select one card and confirm with
                                <strong>Play selected card</strong>.
                            </li>
                            <li>
                                The server rejects illegal plays, including
                                failing to follow suit.
                            </li>
                            <li>
                                Recent tricks display the winner and points
                                collected.
                            </li>
                            <li>
                                Hearts requires four occupied seats. Bots may
                                fill missing seats in a Friendly practice match.
                            </li>
                            <li>
                                Competitive table stakes are resolved at the end
                                of the match. Friendly bot matches use practice
                                stacks and do not change wallets or progression.
                            </li>
                        </ul>
                    `
                }
            ]
        },

        klondike: {
            label: "Klondike",
            title: "How to Play Klondike Solitaire",
            summary:
                "Move every card to four suit foundations, building each foundation from Ace through King.",
            facts: [
                "Seven tableau columns",
                "Four suit foundations",
                "Draw 1 or Draw 3",
                "Unlimited stock passes"
            ],
            sections: [
                {
                    title: "1. Board layout and objective",
                    html: `
                        <ul>
                            <li>
                                <strong>Tableau:</strong> seven columns. The first
                                begins with one card, the second with two, and so
                                on. Only each column's top card begins face-up.
                            </li>
                            <li>
                                <strong>Stock:</strong> undealt cards that can be
                                turned into the waste.
                            </li>
                            <li>
                                <strong>Waste:</strong> face-up cards drawn from
                                the stock. Only the exposed top waste card can be
                                moved.
                            </li>
                            <li>
                                <strong>Foundations:</strong> four piles, one for
                                each suit, built from Ace to King.
                            </li>
                        </ul>
                        <p>
                            You win when all 52 cards have been moved to the
                            foundations.
                        </p>
                    `
                },
                {
                    title: "2. Tableau building rules",
                    html: `
                        <ul>
                            <li>
                                Tableau cards build downward by one rank.
                            </li>
                            <li>
                                Colours must alternate: red on black or black on
                                red.
                            </li>
                            <li>
                                A correctly ordered face-up sequence may move as
                                a group.
                            </li>
                            <li>
                                Only a King, or a sequence beginning with a King,
                                may move into an empty tableau column.
                            </li>
                            <li>
                                When a face-down tableau card becomes exposed,
                                it turns face-up automatically.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "3. Foundations",
                    html: `
                        <p>
                            Each foundation accepts only one suit and builds
                            upward:
                        </p>
                        <p>
                            Ace, 2, 3, 4, 5, 6, 7, 8, 9, 10, Jack, Queen, King.
                        </p>
                        <ul>
                            <li>
                                An Ace starts an empty foundation.
                            </li>
                            <li>
                                Every later card must match the suit and be
                                exactly one rank higher.
                            </li>
                            <li>
                                Double-clicking an exposed top card sends it to a
                                legal foundation when possible.
                            </li>
                            <li>
                                Foundation cards may be moved back to the
                                tableau when needed to unlock another move.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "4. Stock and waste",
                    html: `
                        <p>
                            The selected table option determines whether one or
                            three cards are drawn at a time.
                        </p>
                        <ul>
                            <li>
                                <strong>Draw 1:</strong> each stock click exposes
                                one new waste card.
                            </li>
                            <li>
                                <strong>Draw 3:</strong> up to three cards move to
                                the waste, but only the top exposed card can be
                                played.
                            </li>
                            <li>
                                When the stock empties, the waste is turned back
                                into a face-down stock.
                            </li>
                            <li>
                                This implementation permits unlimited stock
                                passes.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "5. Strategy",
                    html: `
                        <ul>
                            <li>
                                Prioritise moves that reveal face-down tableau
                                cards.
                            </li>
                            <li>
                                Avoid filling an empty column with a King unless
                                doing so reveals cards or enables a useful
                                sequence.
                            </li>
                            <li>
                                Keep foundation ranks reasonably balanced.
                                Advancing one suit too far can remove a card
                                needed to organise the tableau.
                            </li>
                            <li>
                                In Draw 3, remember the order of inaccessible
                                waste cards; changing the number of stock cards
                                can expose a different sequence on the next pass.
                            </li>
                            <li>
                                Use empty columns as temporary workspace, but do
                                not block them casually.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "6. Site controls",
                    html: `
                        <ul>
                            <li><strong>Undo</strong> reverses a recent move.</li>
                            <li>
                                <strong>Hint</strong> identifies a legal move
                                without making it.
                            </li>
                            <li>
                                <strong>Restart deal</strong> restores the same
                                deal to its initial state.
                            </li>
                            <li>
                                <strong>Give up</strong> ends the current deal.
                            </li>
                            <li>
                                <strong>Start another deal</strong> generates the
                                next game after completion.
                            </li>
                            <li>
                                Friendly practice deals change no wallet chips
                                and award no XP.
                            </li>
                        </ul>
                    `
                }
            ]
        },

        spider: {
            label: "Spider",
            title: "How to Play Spider Solitaire",
            summary:
                "Build and remove eight complete King-to-Ace runs. Runs must be entirely one suit before they leave the board.",
            facts: [
                "Ten tableau columns",
                "Eight runs to remove",
                "1, 2 or 4 suits",
                "No foundations"
            ],
            sections: [
                {
                    title: "1. Objective and difficulty",
                    html: `
                        <p>
                            Spider uses two standard decks. Cards are dealt into
                            ten tableau columns, with the remaining cards held in
                            the stock. There are no traditional foundation
                            piles.
                        </p>
                        <p>
                            Complete a descending sequence from King through Ace
                            in one suit. A completed same-suit run is removed
                            automatically. Remove eight runs to win.
                        </p>
                        <ul>
                            <li><strong>1 suit:</strong> easiest.</li>
                            <li>
                                <strong>2 suits:</strong> intermediate; mixed
                                sequences are more restrictive.
                            </li>
                            <li>
                                <strong>4 suits:</strong> hardest and generally
                                hostile to optimism.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "2. Building tableau sequences",
                    html: `
                        <ul>
                            <li>
                                Cards build downward by rank regardless of suit.
                                For example, any Queen may be placed on any King.
                            </li>
                            <li>
                                A single exposed card may be moved whenever the
                                destination is one rank higher.
                            </li>
                            <li>
                                A multi-card sequence may move together only
                                when every card in that moving sequence is
                                descending and the same suit.
                            </li>
                            <li>
                                Empty columns accept any single card or valid
                                movable same-suit sequence.
                            </li>
                            <li>
                                Exposing the top face-down card of a column turns
                                it face-up.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "3. Dealing from the stock",
                    html: `
                        <p>
                            A stock deal places one new face-up card onto every
                            tableau column.
                        </p>
                        <ul>
                            <li>
                                The stock can be dealt only in complete rows of
                                ten cards.
                            </li>
                            <li>
                                Every tableau column must contain at least one
                                card before another stock row can be dealt.
                            </li>
                            <li>
                                A new row may cover useful sequences, so organise
                                the tableau before dealing whenever possible.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "4. Completing and removing runs",
                    html: `
                        <p>
                            A removable run must contain thirteen cards in exact
                            descending order:
                        </p>
                        <p>
                            King, Queen, Jack, 10, 9, 8, 7, 6, 5, 4, 3, 2, Ace.
                        </p>
                        <p>
                            Every card in the run must have the same suit. Once a
                            legal full run forms at the top of a column, it is
                            removed automatically. Mixed-suit descending stacks
                            are useful for temporary storage but cannot complete
                            the game.
                        </p>
                    `
                },
                {
                    title: "5. Strategy",
                    html: `
                        <ul>
                            <li>
                                Expose face-down cards before creating long
                                decorative stacks that accomplish nothing else.
                            </li>
                            <li>
                                Empty columns are the strongest resource in the
                                game. Use them to separate mixed suits and
                                rebuild movable same-suit runs.
                            </li>
                            <li>
                                Prefer same-suit placements when several legal
                                destinations exist.
                            </li>
                            <li>
                                Delay stock deals until available moves have been
                                exhausted or a deliberate plan requires the new
                                row.
                            </li>
                            <li>
                                In 2-suit and 4-suit games, avoid burying a nearly
                                complete run beneath cards of another suit.
                            </li>
                            <li>
                                Sometimes a short-term mixed stack is necessary,
                                but plan how it will later be separated.
                            </li>
                        </ul>
                    `
                },
                {
                    title: "6. Site controls",
                    html: `
                        <ul>
                            <li><strong>Undo</strong> reverses a recent move.</li>
                            <li>
                                <strong>Hint</strong> identifies a legal move.
                            </li>
                            <li>
                                <strong>Restart deal</strong> restores the same
                                starting arrangement.
                            </li>
                            <li>
                                Click the stock when a complete new row can
                                legally be dealt.
                            </li>
                            <li>
                                Friendly practice deals change no wallet chips
                                and award no XP.
                            </li>
                        </ul>
                    `
                }
            ]
        }
    };

    const fileGuideMap = {
        "poker.html": "texas_holdem",
        "poker-table.html": "texas_holdem",
        "five-card-draw-table.html": "five_card_draw",
        "blackjack-table.html": "blackjack",
        "hearts-table.html": "hearts"
    };

    let selectedGuideId = fileGuideMap[currentFile]
        || "klondike";

    function resolveCurrentGuide() {
        if (currentFile !== "solitaire-table.html") {
            return fileGuideMap[currentFile]
                || selectedGuideId;
        }

        const title =
            document.querySelector("#solitaire-title")
                ?.textContent
                ?.toLowerCase()
            || "";

        return title.includes("spider")
            ? "spider"
            : "klondike";
    }

    function injectStyles() {
        if (document.querySelector("#card-game-guide-styles")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "card-game-guide-styles";
        style.textContent = `
            .card-game-guide-launch-row {
                display: flex;
                justify-content: flex-end;
                margin: 0.75rem 0 0.25rem;
            }

            .card-game-guide-button {
                min-height: 2.55rem;
                padding: 0.62rem 0.95rem;
                border: 1px solid rgba(148, 163, 184, 0.25);
                border-radius: 0.8rem;
                background: rgba(17, 25, 38, 0.92);
                color: var(--text, #eef3fb);
                font: inherit;
                font-size: 0.82rem;
                font-weight: 800;
                cursor: pointer;
            }

            .card-game-guide-button:hover,
            .card-game-guide-button:focus-visible {
                border-color: rgba(98, 230, 189, 0.45);
                outline: none;
                background: rgba(24, 35, 51, 0.98);
            }

            .card-game-guide-dialog {
                width: min(1040px, calc(100vw - 2rem));
                max-height: min(88vh, 920px);
                padding: 0;
                border: 1px solid rgba(148, 163, 184, 0.24);
                border-radius: 1rem;
                overflow: hidden;
                background: #0d1420;
                color: #edf3fb;
                box-shadow: 0 28px 80px rgba(0, 0, 0, 0.55);
            }

            .card-game-guide-dialog::backdrop {
                background: rgba(2, 6, 12, 0.78);
                backdrop-filter: blur(5px);
            }

            .card-game-guide-shell {
                display: grid;
                grid-template-rows: auto auto minmax(0, 1fr);
                max-height: inherit;
            }

            .card-game-guide-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 1rem;
                padding: 1.2rem 1.25rem 1rem;
                border-bottom: 1px solid rgba(148, 163, 184, 0.18);
                background: rgba(13, 20, 32, 0.98);
            }

            .card-game-guide-header h2 {
                margin: 0.25rem 0 0;
                font-size: clamp(1.25rem, 3vw, 1.85rem);
            }

            .card-game-guide-close {
                flex: 0 0 auto;
                min-width: 2.55rem;
                min-height: 2.55rem;
                padding: 0;
                border: 1px solid rgba(148, 163, 184, 0.24);
                border-radius: 0.75rem;
                background: rgba(25, 35, 51, 0.9);
                color: #eef3fb;
                font-size: 1.25rem;
                cursor: pointer;
            }

            .card-game-guide-tabs {
                display: flex;
                gap: 0.45rem;
                padding: 0.75rem 1rem;
                overflow-x: auto;
                border-bottom: 1px solid rgba(148, 163, 184, 0.16);
                background: rgba(10, 16, 26, 0.98);
                scrollbar-width: thin;
            }

            .card-game-guide-tab {
                flex: 0 0 auto;
                min-height: 2.25rem;
                padding: 0.5rem 0.75rem;
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 999px;
                background: rgba(20, 29, 43, 0.82);
                color: #cbd6e6;
                font: inherit;
                font-size: 0.76rem;
                font-weight: 800;
                cursor: pointer;
            }

            .card-game-guide-tab.active {
                border-color: rgba(98, 230, 189, 0.46);
                background: rgba(98, 230, 189, 0.13);
                color: #dcfff4;
            }

            .card-game-guide-scroll {
                overflow-y: auto;
                padding: 1.15rem 1.25rem 1.5rem;
            }

            .card-game-guide-summary {
                display: grid;
                gap: 0.85rem;
                margin-bottom: 1rem;
                padding: 1rem;
                border: 1px solid rgba(148, 163, 184, 0.18);
                border-radius: 0.85rem;
                background: rgba(20, 29, 43, 0.72);
            }

            .card-game-guide-summary p {
                margin: 0;
                color: #c7d2e2;
                line-height: 1.65;
            }

            .card-game-guide-facts {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
            }

            .card-game-guide-fact {
                padding: 0.35rem 0.58rem;
                border: 1px solid rgba(98, 230, 189, 0.2);
                border-radius: 999px;
                background: rgba(98, 230, 189, 0.08);
                color: #bdebdc;
                font-size: 0.72rem;
                font-weight: 800;
            }

            .card-game-guide-tools {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 0.75rem;
            }

            .card-game-guide-toggle {
                padding: 0.46rem 0.7rem;
                border: 1px solid rgba(148, 163, 184, 0.2);
                border-radius: 0.65rem;
                background: rgba(18, 27, 40, 0.9);
                color: #dce5f2;
                font: inherit;
                font-size: 0.74rem;
                font-weight: 800;
                cursor: pointer;
            }

            .card-game-guide-section {
                margin-bottom: 0.65rem;
                border: 1px solid rgba(148, 163, 184, 0.17);
                border-radius: 0.8rem;
                overflow: hidden;
                background: rgba(14, 21, 33, 0.8);
            }

            .card-game-guide-section summary {
                padding: 0.9rem 1rem;
                cursor: pointer;
                color: #f3f7fc;
                font-weight: 850;
                line-height: 1.35;
            }

            .card-game-guide-section[open] summary {
                border-bottom: 1px solid rgba(148, 163, 184, 0.14);
                background: rgba(29, 40, 57, 0.56);
            }

            .card-game-guide-section-copy {
                padding: 0.95rem 1rem 1.05rem;
                color: #c6d1e1;
                line-height: 1.68;
            }

            .card-game-guide-section-copy p {
                margin: 0 0 0.8rem;
            }

            .card-game-guide-section-copy p:last-child {
                margin-bottom: 0;
            }

            .card-game-guide-section-copy ul,
            .card-game-guide-section-copy ol {
                display: grid;
                gap: 0.5rem;
                margin: 0.7rem 0 0.85rem;
                padding-left: 1.3rem;
            }

            .card-game-guide-section-copy strong {
                color: #f1f6fc;
            }

            .card-guide-table-wrap {
                max-width: 100%;
                overflow-x: auto;
                border: 1px solid rgba(148, 163, 184, 0.15);
                border-radius: 0.7rem;
            }

            .card-guide-table {
                width: 100%;
                min-width: 720px;
                border-collapse: collapse;
                font-size: 0.78rem;
            }

            .card-guide-table th,
            .card-guide-table td {
                padding: 0.65rem 0.7rem;
                border-bottom: 1px solid rgba(148, 163, 184, 0.13);
                text-align: left;
                vertical-align: top;
            }

            .card-guide-table th {
                background: rgba(34, 46, 64, 0.78);
                color: #f4f8fd;
            }

            .card-guide-table td:first-child {
                width: 3rem;
                color: #9eb0c6;
                font-weight: 800;
            }

            .card-game-guide-dialog.fallback-open {
                position: fixed;
                inset: 50% auto auto 50%;
                z-index: 5000;
                display: block;
                transform: translate(-50%, -50%);
            }

            body.card-game-guide-locked {
                overflow: hidden;
            }

            @media (max-width: 650px) {
                .card-game-guide-dialog {
                    width: calc(100vw - 1rem);
                    max-height: 94vh;
                }

                .card-game-guide-header,
                .card-game-guide-scroll {
                    padding-left: 0.85rem;
                    padding-right: 0.85rem;
                }

                .card-game-guide-launch-row {
                    justify-content: stretch;
                }

                .card-game-guide-button {
                    width: 100%;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .card-game-guide-dialog,
                .card-game-guide-button,
                .card-game-guide-tab {
                    scroll-behavior: auto;
                    transition: none;
                }
            }
        `;

        document.head.append(style);
    }

    function guideHeaderTarget() {
        return document.querySelector(
            ".poker-heading, "
            + ".live-poker-header, "
            + ".draw-header, "
            + ".blackjack-header, "
            + ".hearts-header, "
            + ".solitaire-header"
        );
    }

    function createLaunchButton() {
        if (document.querySelector("#card-game-guide-button")) {
            return;
        }

        const row = document.createElement("div");
        row.className = "card-game-guide-launch-row";

        const button = document.createElement("button");
        button.id = "card-game-guide-button";
        button.className = "card-game-guide-button";
        button.type = "button";
        button.textContent = currentFile === "poker.html"
            ? "Game rules and guides"
            : "How to play";

        button.addEventListener("click", openGuide);
        row.append(button);

        const header = guideHeaderTarget();

        if (header?.parentNode) {
            header.insertAdjacentElement("afterend", row);
        } else {
            document.querySelector("main")?.prepend(row);
        }
    }

    function createDialog() {
        const existing =
            document.querySelector("#card-game-guide-dialog");

        if (existing) {
            return existing;
        }

        const dialog = document.createElement("dialog");
        dialog.id = "card-game-guide-dialog";
        dialog.className = "card-game-guide-dialog";

        dialog.innerHTML = `
            <div class="card-game-guide-shell">
                <header class="card-game-guide-header">
                    <div>
                        <p class="eyebrow">COMPLETE GAME GUIDE</p>
                        <h2 id="card-game-guide-title">
                            How to play
                        </h2>
                    </div>

                    <button
                        id="card-game-guide-close"
                        class="card-game-guide-close"
                        type="button"
                        aria-label="Close game guide"
                    >
                        ×
                    </button>
                </header>

                <nav
                    id="card-game-guide-tabs"
                    class="card-game-guide-tabs"
                    aria-label="Choose a game guide"
                ></nav>

                <div class="card-game-guide-scroll">
                    <section
                        id="card-game-guide-summary"
                        class="card-game-guide-summary"
                    ></section>

                    <div class="card-game-guide-tools">
                        <button
                            id="card-game-guide-toggle"
                            class="card-game-guide-toggle"
                            type="button"
                        >
                            Expand all
                        </button>
                    </div>

                    <div id="card-game-guide-content"></div>
                </div>
            </div>
        `;

        document.body.append(dialog);

        dialog
            .querySelector("#card-game-guide-close")
            .addEventListener("click", closeGuide);

        dialog
            .querySelector("#card-game-guide-toggle")
            .addEventListener("click", toggleAllSections);

        dialog.addEventListener("click", (event) => {
            if (event.target === dialog) {
                closeGuide();
            }
        });

        dialog.addEventListener("close", () => {
            document.body.classList.remove(
                "card-game-guide-locked"
            );
        });

        renderTabs(dialog);
        return dialog;
    }

    function renderTabs(dialog) {
        const tabs =
            dialog.querySelector("#card-game-guide-tabs");
        tabs.replaceChildren();

        for (const [guideId, guide] of Object.entries(guides)) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "card-game-guide-tab";
            button.dataset.guideId = guideId;
            button.textContent = guide.label;

            button.addEventListener("click", () => {
                selectedGuideId = guideId;
                renderGuide(guideId);
            });

            tabs.append(button);
        }
    }

    function renderGuide(guideId) {
        const guide = guides[guideId];

        if (!guide) {
            return;
        }

        selectedGuideId = guideId;

        const dialog = createDialog();
        const title =
            dialog.querySelector("#card-game-guide-title");
        const summary =
            dialog.querySelector("#card-game-guide-summary");
        const content =
            dialog.querySelector("#card-game-guide-content");
        const toggle =
            dialog.querySelector("#card-game-guide-toggle");

        title.textContent = guide.title;

        summary.innerHTML = `
            <p>${guide.summary}</p>
            <div class="card-game-guide-facts">
                ${guide.facts.map((fact) => `
                    <span class="card-game-guide-fact">
                        ${fact}
                    </span>
                `).join("")}
            </div>
        `;

        content.replaceChildren();

        guide.sections.forEach((section, index) => {
            const details = document.createElement("details");
            details.className = "card-game-guide-section";
            details.open = index < 2;

            const heading = document.createElement("summary");
            heading.textContent = section.title;

            const copy = document.createElement("div");
            copy.className = "card-game-guide-section-copy";
            copy.innerHTML = section.html;

            details.append(heading, copy);
            content.append(details);
        });

        dialog
            .querySelectorAll(".card-game-guide-tab")
            .forEach((button) => {
                const active =
                    button.dataset.guideId === guideId;
                button.classList.toggle("active", active);
                button.setAttribute(
                    "aria-current",
                    active ? "true" : "false"
                );
            });

        toggle.textContent = "Expand all";

        dialog
            .querySelector(".card-game-guide-scroll")
            .scrollTo({ top: 0, behavior: "instant" });
    }

    function toggleAllSections() {
        const dialog = createDialog();
        const sections = Array.from(
            dialog.querySelectorAll(
                ".card-game-guide-section"
            )
        );

        const shouldOpen =
            sections.some((section) => !section.open);

        sections.forEach((section) => {
            section.open = shouldOpen;
        });

        dialog
            .querySelector("#card-game-guide-toggle")
            .textContent = shouldOpen
                ? "Collapse all"
                : "Expand all";
    }

    function openGuide() {
        const guideId = resolveCurrentGuide();
        renderGuide(guideId);

        const dialog = createDialog();

        if (typeof dialog.showModal === "function") {
            if (!dialog.open) {
                dialog.showModal();
            }
        } else {
            dialog.setAttribute("open", "");
            dialog.classList.add("fallback-open");
        }

        document.body.classList.add(
            "card-game-guide-locked"
        );

        dialog
            .querySelector("#card-game-guide-close")
            .focus();
    }

    function closeGuide() {
        const dialog =
            document.querySelector("#card-game-guide-dialog");

        if (!dialog) {
            return;
        }

        if (
            typeof dialog.close === "function"
            && dialog.open
        ) {
            dialog.close();
        } else {
            dialog.removeAttribute("open");
            dialog.classList.remove("fallback-open");
        }

        document.body.classList.remove(
            "card-game-guide-locked"
        );

        document
            .querySelector("#card-game-guide-button")
            ?.focus();
    }

    function positionBotMenus() {
        const placements = {
            "poker-table.html": {
                panel: "#card-bot-manager",
                anchor: "#action-controls"
            },
            "five-card-draw-table.html": {
                panel: "#card-bot-manager",
                anchor: "#draw-controls"
            },
            "blackjack-table.html": {
                panel: "#card-bot-manager",
                anchor: ".blackjack-host-controls"
            },
            "hearts-table.html": {
                panel: "#hearts-bot-manager",
                anchor: "#play-controls"
            }
        };

        const placement = placements[currentFile];

        if (!placement) {
            return;
        }

        const panel =
            document.querySelector(placement.panel);
        const anchor =
            document.querySelector(placement.anchor);

        if (
            panel
            && anchor
            && panel.previousElementSibling !== anchor
        ) {
            anchor.insertAdjacentElement(
                "afterend",
                panel
            );
        }
    }

    injectStyles();
    createLaunchButton();
    createDialog();
    renderGuide(resolveCurrentGuide());

    /*
     * Finite retries handle asynchronously loaded bot controllers without
     * introducing another permanent MutationObserver. We have suffered
     * enough observer-based theatre for one project.
     */
    [0, 250, 1000, 2500].forEach((delay) => {
        window.setTimeout(positionBotMenus, delay);
    });

    window.addEventListener("load", positionBotMenus);
})();
