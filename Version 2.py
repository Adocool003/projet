import random

def creer_grille():
    """Crée une grille vide de taille 10x10 remplie de ' '."""
    return [[' ' for _ in range(10)] for _ in range(10)]

def convertir_taille_en_lettre(taille):
    """Convertit la taille numérique du bateau en sa lettre correspondante."""
    correspondances = {
        5: 'P',  # Porte-avion
        4: 'C',  # Croiseur
        3: 'S',  # Sous-marin
        2: 'T',  # Torpilleur
        1: 'B'   # Barque
    }
    return correspondances[taille]

def placer_bateaux_utilisateur(grille):
    """Permet au joueur de placer manuellement ses bateaux."""
    bateaux = [5, 4, 3, 2, 1]  # Tailles des bateaux
    for taille in bateaux:
        place = False
        lettre_bateau = convertir_taille_en_lettre(taille)
        while not place:
            print(f"Placement du bateau : {lettre_bateau} (taille {taille})")
            afficher_grille(grille)

            ligne_input = input("Ligne de départ (A-J) : ").upper()
            colonne_input = input("Colonne de départ (1-10) : ")
            orientation = input("Orientation (H pour horizontal, V pour vertical) : ").upper()

            if len(ligne_input) != 1 or ligne_input < 'A' or 'J' < ligne_input:
                print("Ligne invalide. Veuillez entrer une lettre entre A et J.")
                continue

            if not colonne_input.isdigit() or int(colonne_input) < 1 or int(colonne_input) > 10:
                print("Colonne invalide. Veuillez entrer un nombre entre 1 et 10.")
                continue

            ligne = ord(ligne_input) - 65
            colonne = int(colonne_input) - 1

            if orientation not in ['H', 'V']:
                print("Orientation invalide. Veuillez entrer H ou V.")
                continue

            if orientation == 'H':
                if colonne + taille <= 10 and all(grille[ligne][col] == ' ' for col in range(colonne, colonne + taille)):
                    for col in range(colonne, colonne + taille):
                        grille[ligne][col] = lettre_bateau
                    place = True
                else:
                    print("Placement invalide. Vérifiez que l'espace est libre et dans les limites de la grille.")
            else:  # orientation == 'V'
                if ligne + taille <= 10 and all(grille[lig][colonne] == ' ' for lig in range(ligne, ligne + taille)):
                    for lig in range(ligne, ligne + taille):
                        grille[lig][colonne] = lettre_bateau
                    place = True
                else:
                    print("Placement invalide. Vérifiez que l'espace est libre et dans les limites de la grille.")
    print("Tous les bateaux ont été placés avec succès et voici votre grille!")
    afficher_grille(grille)

def placer_bateaux_ordinateur(grille):
    """Place aléatoirement les bateaux sur la grille de l'ordinateur."""
    bateaux = [5, 4, 3, 2, 1]  # Tailles des bateaux
    for taille in bateaux:
        place = False
        lettre_bateau = convertir_taille_en_lettre(taille)
        while not place:
            orientation = random.choice(['H', 'V'])  # H pour horizontal, V pour vertical
            ligne = random.randint(0, 9)
            colonne = random.randint(0, 9)
            if orientation == 'H':
                if colonne + taille <= 10 and all(grille[ligne][col] == ' ' for col in range(colonne, colonne + taille)):
                    for col in range(colonne, colonne + taille):
                        grille[ligne][col] = lettre_bateau
                    place = True
            else:  # orientation == 'V'
                if ligne + taille <= 10 and all(grille[lig][colonne] == ' ' for lig in range(ligne, ligne + taille)):
                    for lig in range(ligne, ligne + taille):
                        grille[lig][colonne] = lettre_bateau
                    place = True

def afficher_grilles_cote_a_cote(grille1, grille2):
    """Affiche deux grilles côte à côte."""
    header = "    " + "   ".join(map(str, range(1, 11)))
    separator = "  " + "---" * 13 + "--"
    print(header + "        " + header)
    print(separator + "        " + separator)

    for i in range(10):
        ligne1 = " | ".join(grille1[i])
        ligne2 = " | ".join(grille2[i])
        print(chr(65 + i) + " | " + ligne1 + " |" + "        " + chr(65 + i) + " | " + ligne2 + " |")
        print(separator + "        " + separator)

def afficher_grille(grille_visibles):
    """Affiche une seule grille."""
    print("    " + "   ".join(map(str, range(1, 11))))
    print("  " + "---" * 13 + "--")
    for i, ligne in enumerate(grille_visibles):
        print(chr(65 + i) + " | " + " | ".join(ligne) + " |")
        print("  " + "---" * 13 + "--")

def verifier_bateau_coule_joueur(grille, grille_visibles, taille):
    """Vérifie si un bateau de la taille donnée est coulé et met à jour la grille visible."""
    bateau_positions = []
    for i, ligne in enumerate(grille):
        for j, cell in enumerate(ligne):
            if cell == taille:
                bateau_positions.append((i, j))

    if not bateau_positions:
        for i, ligne in enumerate(grille):
            for j, cell in enumerate(ligne):
                if grille_visibles[i][j] == '+' and all(
                    grille[x][y] == ' ' for x, y in bateau_positions
                ):
                    grille_visibles[i][j] = 'x'
        return True

    return False


def verifier_bateau_coule_ordinateur(grille, grille_visibles, taille):
    """Vérifie si un bateau de la taille donnée est coulé et met à jour la grille visible."""
    bateau_positions = []
    for i, ligne in enumerate(grille):
        for j, cell in enumerate(ligne):
            if cell == taille:
                bateau_positions.append((i, j))

    if not bateau_positions:
        for i, ligne in enumerate(grille):
            for j, cell in enumerate(ligne):
                if grille_visibles[i][j] == '+' and all(
                    grille[x][y] == ' ' for x, y in bateau_positions
                ):
                    grille_visibles[i][j] = 'x'
        return True

    return False


def nom_bateau(taille):
    """Retourne le nom du bateau en fonction de sa taille."""
    correspondances = {
        'P': "porte-avion",
        'C': "croiseur",
        'S': "sous-marin",
        'T': "torpilleur",
        'B': "barque"
    }
    return correspondances.get(taille, "inconnu")

def verifier_victoire(grille):
    """Vérifie si tous les bateaux ont été coulés."""
    for ligne in grille:
        for cell in ligne:
            if cell in ['P', 'C', 'S', 'T', 'B']:
                return False
    return True

def tour_de_jeu(joueur, grille_adverse, grille_visibles_adverses, coups_joues):
    """Gère un tour de jeu pour le joueur actuel."""
    if joueur == 1:
        print("\nC'est votre tour !")
        afficher_grilles_cote_a_cote(grille_visibles_j1, grille_visibles_j2)

    while True:
        if joueur == 1:
            ligne_input = input("Ligne (A-J) : ").upper()
            colonne_input = input("Colonne (1-10) : ")

            if len(ligne_input) != 1 or ligne_input < 'A' or 'J' < ligne_input:
                print("Ligne invalide. Vous devez entrer une lettre en majuscule entre A et J. Essayez encore.")
                continue

            if not colonne_input.isdigit() or int(colonne_input) < 1 or int(colonne_input) > 10:
                print("Colonne invalide. Le nombre doit être compris entre 1 et 10. Essayez encore.")
                continue

            ligne = ord(ligne_input) - 65
            colonne = int(colonne_input) - 1
        else:
            ligne = random.randint(0, 9)
            colonne = random.randint(0, 9)
            if (ligne, colonne) in coups_joues:
                continue

        if (ligne, colonne) in coups_joues:
            if joueur == 1:
                print("Vous avez déjà joué cette case. Essayez une autre case.")
            continue

        coups_joues.add((ligne, colonne))
        if grille_adverse[ligne][colonne] == ' ':
            if joueur == 1:
                print("Vous avez tiré dans l'eau !")
            elif joueur==2:
                print("L'ordinateur a tiré dans l'eau !")
            grille_visibles_adverses[ligne][colonne] = '*'
            
                
        else:
            if joueur == 1:
                print("Vous avez touché !")
            elif joueur==2:
                print("L'ordinateur a Touché !")
            taille_bateau = grille_adverse[ligne][colonne]
            grille_adverse[ligne][colonne] = ' '
            grille_visibles_adverses[ligne][colonne] = '+'

            # Vérifier si le bateau est coulé
            if joueur == 1:
                if(verifier_bateau_coule_joueur(grille_adverse, grille_visibles_adverses, taille_bateau)):

                    print("Vous avez coulé un", nom_bateau(taille_bateau), "!")
            else:
                if (verifier_bateau_coule_ordinateur(grille_adverse, grille_visibles_adverses, taille_bateau)):
                    print("L'ordinateur a coulé un", nom_bateau(taille_bateau), "!")
                
        if verifier_victoire(grille_adverse):
            if joueur == 1:
                print("Félicitations ! Vous avez coulé tous les bateaux de l'ordinateur ! Vous avez gagné !")
            else:
                print("L'ordinateur a gagné !")
            return True

        return False

# Initialisation des grilles
print("Bienvenue dans Bataille Navale !")
grille_j1 = creer_grille()
grille_j2 = creer_grille()

print("\nJoueur 1, placez vos bateaux.")
placer_bateaux_utilisateur(grille_j1)
placer_bateaux_ordinateur(grille_j2)

grille_visibles_j1 = [[' ' for _ in range(10)] for _ in range(10)]
grille_visibles_j2 = [row[:] for row in grille_j1]

coups_j1 = set()
coups_j2 = set()

# Boucle principale du jeu
joueur_actuel = 1
while True:
    if joueur_actuel == 1:
        if tour_de_jeu(1, grille_j2, grille_visibles_j1, coups_j2):
            break
        joueur_actuel = 2
    else:
        if tour_de_jeu(2, grille_j1, grille_visibles_j2, coups_j1):
            break
        joueur_actuel = 1
