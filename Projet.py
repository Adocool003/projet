import random

def creer_grille():
    """Crée une grille vide de taille 10x10 remplie de croix ('x')."""
    return [['x' for _ in range(10)] for _ in range(10)]

def placer_bateaux(grille):
    """Place aléatoirement les bateaux de tailles différentes sur la grille."""
    bateaux = [5, 4, 3, 2, 1]  # Tailles des bateaux
    for taille in bateaux:
        place = False
        while not place:
            orientation = random.choice(['H', 'V'])  # H pour horizontal, V pour vertical
            ligne = random.randint(0, 9)
            colonne = random.randint(0, 9)
            if orientation == 'H':
                if colonne + taille <= 10 and all(grille[ligne][col] == 'x' for col in range(colonne, colonne + taille)):
                    for col in range(colonne, colonne + taille):
                        grille[ligne][col] = str(taille)
                        orientation = random.choice(['H', 'V'])
                    place = True
            else:  # orientation == 'V'
                if ligne + taille <= 10 and all(grille[lig][colonne] == 'x' for lig in range(ligne, ligne + taille)):
                    for lig in range(ligne, ligne + taille):
                        grille[lig][colonne] = str(taille)
                        orientation = random.choice(['H', 'V'])
                    place = True

def afficher_grille(grille_visibles):
    """Affiche la grille en fonction des coups joués."""
    print("    " + "   ".join(map(str, range(1, 11))))
    print("  " + "---" * 13 + "--")
    for i, ligne in enumerate(grille_visibles):
        print(chr(65 + i) + " | " + " | ".join(ligne) + " |")
        print("  " + "---" * 13 + "--")

def verifier_bateau_coule(grille, grille_visibles, taille):
    """Vérifie si un bateau de la taille donnée est coulé et met à jour la grille visible."""
    bateau_positions = []
    for i, ligne in enumerate(grille):
        for j, cell in enumerate(ligne):
            if cell == taille:
                bateau_positions.append((i, j))

    if not bateau_positions:
        for i in range(len(grille_visibles)):
            for j in range(len(grille_visibles[i])):
                if grille_visibles[i][j] == '+':
                    grille_visibles[i][j] = 'x'
        return True

    return False

def nom_bateau(taille):
    """Retourne le nom du bateau en fonction de sa taille."""
    if taille == '5':
        return "porte-avion"
    elif taille == '4':
        return "croiseur"
    elif taille == '3':
        return "sous-marin"
    elif taille == '2':
        return "torpilleur"
    elif taille == '1':
        return "barque"


def verifier_victoire(grille):
    """Vérifie si tous les bateaux ont été coulés."""
    for ligne in grille:
        for cell in ligne:
            if cell.isdigit():
                return False
    return True


    # Création et placement des bateaux (une seule fois)
grille = creer_grille()
placer_bateaux(grille)

    # Grille visible pour le joueur
grille_visibles = [[' ' for _ in range(10)] for _ in range(10)]
coups_joues = set()

print("Grille initiale :")
afficher_grille(grille_visibles)


T=True
    # Interaction utilisateur
while T:
        a=0
        print("\nEntrez les coordonnées de votre tir.")
        ligne_input = input("Ligne (A-J) : ")
        
        if ligne_input == 'stop' :
            print("Fin du jeu.")
            T=False
            
        else:
        
            colonne_input = input("Colonne (1-10) : ")

        

            if len(ligne_input) != 1 or ligne_input<'A' or 'J'<ligne_input :
                print("Ligne invalide. Vous devez entrer une lettre en majuscule entre A et J. Essayez encore.")
                continue
        
        
            if not(colonne_input.isdigit()) or int(colonne_input) < 1 or 10 < int(colonne_input) :
                print("Colonne invalide. Le nombre doit être compris entre 1 et 10. Essayez encore.")
                continue
    
            ligne = ord(ligne_input) - 65
            colonne = int(colonne_input) - 1
    
            if (ligne, colonne) in coups_joues:
                print("Vous avez déjà joué cette case. Essayez une autre case.")
                continue
    
            if 0 <= ligne < 10 and 0 <= colonne < 10:
                coups_joues.add((ligne, colonne))
                if grille[ligne][colonne] == 'x':
                    t=0   
                    
                    grille_visibles[ligne][colonne] = '*'
                else:
                    t=1
                    
                    taille_bateau = grille[ligne][colonne]
                    grille[ligne][colonne] = 'x'
                    grille_visibles[ligne][colonne] = '+'
    
                    # Vérifier si le bateau est coulé
                    if verifier_bateau_coule(grille, grille_visibles, taille_bateau):
                        a=1
                        
                        
                        
                afficher_grille(grille_visibles)        
                if t==0:
                    print("Dans l'eau !")
                elif t==1:
                    print("Touché !")
                if a==1:
                    print("Vous avez coulé un",nom_bateau(taille_bateau),"!")
                        
    
                
    
                # Vérifier la victoire
                if verifier_victoire(grille):
                    print("Félicitations ! Vous avez coulé tous les bateaux ! Vous avez gagné !")
                    T=False
       

