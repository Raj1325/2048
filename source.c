#include<stdio.h>
#include<stdlib.h>
#include<string.h>
//#define LIMIT 0

struct Node
{
	int data;
	int index;
	struct Node *up,*down,*left,*right;
};

// Matrix table using graph.

struct MatrixTable
{
	int index;
	struct Node *address;
};


// Link List model.

struct LinkList
{
	struct Node *address;
	struct LinkList *next;
};

//Leaders board node.
struct leadersBoardList
{
    struct leadersBoardList *backLink;
    struct leadersBoardList *forwardLink;
    char playerName[50];
    int score;
};

static int addBefore(struct leadersBoardList* , struct leadersBoardList*);
static void addAfter(struct leadersBoardList* , struct leadersBoardList*);
struct leadersBoardList* create_leaders_node();
void release_list(struct leadersBoardList**);
void attach_Lnode(struct leadersBoardList** , struct leadersBoardList*);


// Global variables
struct Node *node;
struct MatrixTable *table;
struct LinkList *head = NULL;
int static score=0;
// Function prototype,s

void get_RowsCols(int*,int*);

void create_MatrixTable(int , int);

void link_Matrix(int , int);

void traverse_Matrix();

/* Link LIst Prototype's for stack*/

void push_Node(struct Node*);

struct Node* pop_Node();

/* Matrix element movement according to shift*/
int shift_Left();
int shift_Right();
int shift_Down();
int shift_Up();

/*To generate random numbers 2 and 4*/
int generate_number();
/*To look the empty node*/
struct Node* look_node(int,int);
/*To check if game is over*/
char is_game_over();
/*To compare two string*/
char compare(char *,char *);
/*To display the leaders board*/
void leaders_board();


int main(void)
{
	int rows,cols,i,rowCnt,colCnt,highScore;
	char option,gameOver = 'n',playerName[50],name[50],cmpResult,contOption,player[50];
	int number,displacement,checkFscanf;
	struct Node *node,*rowNode;
	char fileType_txt[10]={'.','t','x','t'};
	FILE *playersList,*playerBoard;

    printf("\nEnter player name :");
	fgets(playerName,50,stdin);
	i = strlen(playerName);
	i--;
	if(playerName[i] == '\n')
    {
        playerName[i] = '\0';
    }

    playersList = fopen("playersNameList.txt","r");
    i = -1;
    while(!feof(playersList))
    {
        do{
            i++;
            name[i] = fgetc(playersList);
        }while((name[i]!='\0') && (!feof(playersList)));
        fgetc(playersList);
        i = -1;
        cmpResult = compare(name,playerName);
        //printf(" %c",cmpResult);
        if(cmpResult == 'y')
            break;
    }
    fclose(playersList);
    if(cmpResult == 'n')
    {
        playersList = fopen("playersNameList.txt","a");
        i= -1;
        do
        {
            i++;
            fputc(playerName[i],playersList);
        }while(playerName[i] != '\0');
        fputc('\n',playersList);
        fclose(playersList);
        strcpy(player,playerName);
        strcat(playerName,fileType_txt);
    }
    if(cmpResult == 'y')
    {
         strcat(playerName,fileType_txt);
         printf("\n\n\tDo you wish to start from your last session[y/n]:");
         scanf(" %c",&option);
         if(option == 'y')
         {
            if((playersList = fopen(playerName,"r")) != NULL)
            {
                if((checkFscanf = fscanf(playersList,"%d %d %d",&score,&rows,&cols)) == 3)
                {
                    create_MatrixTable(rows,cols);
                    link_Matrix(rows,cols);
                    rowNode = table->address;
                    for(rowCnt = 0; rowCnt<rows;rowCnt++)
                    {
                        node = rowNode;
                        for(colCnt = 0;colCnt<cols;colCnt++)
                        {
                            fscanf(playersList,"%d",&(node->data));
                            node = node->left;
                        }
                        rowNode = rowNode->down;
                    }
                    fclose(playersList);
                }
                else
                {
                printf("\nYour previous data is wiped by your previous action's...\n");
                cmpResult = 'n';
                }
            }
            else
            {
                printf("\nYou have no previous data...\n");
                cmpResult = 'n';
            }
         }
         else
         {
            cmpResult = 'n';
            playerBoard = fopen(playerName,"w");
            fprintf(playerBoard,"%d",0);
            fclose(playerBoard);
            leaders_board();
         }
    }
    do{
        fflush(stdin);
    if(cmpResult == 'n')
    {

        get_RowsCols(&rows,&cols);
        create_MatrixTable(rows,cols);
        link_Matrix(rows,cols);
        number = generate_number();
        node = look_node(rows,cols);
        node->data = number;
    }


	number = generate_number();
	node = look_node(rows,cols);
    if(node != NULL)
        node->data = number;
    if((playerBoard = fopen("leadersBoardFile.txt","r")) == NULL)
    {
        printf("\nError opening Leader Board...\nError Label : (LBfHS)");
        strcpy(name,"YOUR'S");
        highScore = score;
    }
    else
    {
        i = -1;
        do{
            i++;
            name[i] = fgetc(playerBoard);
        }while((name[i] != '#') && (!feof(playerBoard)));
        fclose(playerBoard);
        i = strlen(name);
        while(name[i] != '#')
            i--;
        name[i] = '\0';
        if(!strcmp(name,player))
        {
            strcpy(name,"YOUR'S");
        }
        playerBoard = fopen("highScore.txt","r");
        fscanf(playerBoard,"%d",&highScore);
        fclose(playerBoard);
    }
    printf("Your Score : %d\nHighest Score : [%s : %d]\n",score,name,highScore);
	traverse_Matrix();

	do{
    gameOver = is_game_over();
    if('y' == gameOver)
    {
        printf("\n\n\t\tGAME OVER\n\n");
    }
    else
    {
    option = getc();
    printf("\n%c",option);
		if(option == 'w')
			displacement = shift_Up();
		else if(option == 'd')
			displacement = shift_Right();
		else if(option == 'a')
			displacement = shift_Left();
		else if(option == 's')
			displacement = shift_Down();
        else if(option == 'e')
            contOption = 'n';
        if(option != 'e')
        {
            if(displacement == 1)
            {
                number = generate_number();
                node = look_node(rows,cols);
                if(node != NULL)
                    node->data = number;
            }
            printf("\n\n+*+*+*+*+*+*+*+*+*+*+*+*+*+*+*+*+*\n\n");
            if(score >= highScore)
            {
                highScore = score;
                strcpy(name,"YOUR'S");
            }
            printf("Your Score : %d\nHighest Score : [%s : %d]\n",score,name,highScore);
            traverse_Matrix();
        }
    }
	}while(option != 'e' && gameOver == 'n');
	if(option != 'e')
	{
		printf("\n\n\t\tDo you want to play another session?\n\t\tReplay[y/n]:");
		scanf(" %c",&contOption);
		if(contOption == 'y')
        {
            cmpResult = 'n';
            score = 0;
        }
	}
	if(option == 'e' || contOption == 'n')
    {
        contOption = 'n'; // if user press 'y' to continue game and next time presses 'e' then to change flag to 'n';
         playersList = fopen(playerName,"w");
         fprintf(playersList,"%d\n%d\n%d\n",score,rows,cols);
         rowNode = table->address;
         for(rowCnt = 0; rowCnt<rows;rowCnt++)
         {
             node = rowNode;
             for(colCnt = 0;colCnt<cols;colCnt++)
             {
                 fprintf(playersList,"%d\n",node->data);
                 node = node->left;
             }
             rowNode = rowNode->down;
         }
        fclose(playersList);
    }
	}while(contOption == 'y' || contOption == 'Y');
	//printf("Node attached successfully..\n");
	leaders_board();
	exit(0);
}


void push_Node(struct Node *node)
{
    struct LinkList *tmp,*listNode;
    listNode = (struct LinkList*)malloc(sizeof(struct LinkList));
    listNode->next = NULL;
    listNode->address = node;
    if(head == NULL)
    {
        head = listNode;
    }
    else
    {
        tmp = head;
        while(tmp->next != NULL)
        {
            tmp = tmp->next;
        }
        tmp->next = listNode;

    }
}

struct Node* pop_Node()
{
	struct LinkList *temp;
	struct Node *returnNode;
	if(head != NULL)
	{
		temp = head;
		head = head->next;
		returnNode = temp->address;
		free(temp);
	}
	else
	{
		returnNode = NULL;
	}
	//printf("Returned Successfully\n");
	return returnNode;
}


void get_RowsCols(int* row,int* col)
{
	printf("Enter the rows for matrix\n\n\t\tRows :");
	scanf(" %d",row);
	printf("Enter the columns for matrix\n\n\t\tColumns :");
	scanf(" %d",col);
	printf("\n");
}

/////////////


void create_MatrixTable(int rows, int cols)
{
	int totalNodes,counter;

	totalNodes = rows * cols;
	free(table);
	table = (struct MatrixTable*)malloc(sizeof(struct MatrixTable) * totalNodes);
	for(counter=0;counter<totalNodes;counter++)
	{
		node = (struct Node*)malloc(sizeof(struct Node));
		node->up = NULL;
		node->down = NULL;
		node->left = NULL;
		node->right = NULL;
		node->index = counter;
		//printf("Enter the data for %x : ",node);
		//scanf(" %d",&(node->data));
		node->data = 0;
		(table+counter)->address = node;
		(table+counter)->index = counter;
	}
	/*for(counter=0;counter<totalNodes;counter++)
	{
		printf("%d\t%x\n",(table+counter)->index,(table+counter)->address);

	}
	//printf("Table created Successfully\n");*/
}



void link_Matrix(int rows, int cols)
{
	// Here first we will do down linking...
	int rowCount,colCount,verticalLimit,horiLimit,ref;
	struct Node *linkSender,*linkAccepter;
	verticalLimit = (rows-1)*cols;
	horiLimit = (cols-1);
	for(rowCount = 0; rowCount < verticalLimit; rowCount++)
	{
		linkSender = (table+rowCount)->address;
		linkAccepter = (table+(rowCount+cols))->address;            /* here is the error*/
		linkSender->down = linkAccepter;
		linkAccepter->up = linkSender;
	}
	linkSender = NULL; linkAccepter = NULL;
	for(rowCount=0;rowCount<rows;rowCount++)
	{
		colCount = rowCount*cols;
		for(ref=0;ref< horiLimit;ref++)
		{

			linkSender = (table+colCount)->address;
			linkAccepter = (table+(colCount+1))->address;
			linkSender->left = linkAccepter;
			linkAccepter->right = linkSender;
			colCount++;
		}
	}
	/*for(rowCount = 0;rowCount < (rows*cols);rowCount++)
	{
		linkSender = (table+rowCount)->address;
		printf(" %d\t%d\t%x\t%x\t%x\t%x\n",linkSender->index,linkSender->data,linkSender->up,linkSender->down,linkSender->right,linkSender->left);
	}*/
	linkSender = NULL;
	linkAccepter = NULL;
	//printf("Link Successful\n");
}


void traverse_Matrix()
{

	struct Node *tmp;
	tmp = NULL;
	push_Node(table->address);
	while(head!=NULL)
	{
		tmp = pop_Node();
		if(tmp->down != NULL)
			push_Node(tmp->down);
		while( tmp != NULL)
		{
		    if(tmp->data == 0)
            {
                printf("-\t");
            }
            else
            {
                printf(" %d\t",tmp->data);
            }
            tmp = tmp->left;

		}
		printf("\n\n\n\n");

	}
}


int shift_Right()
{
		struct Node *currentNode , *nextNode;
		int match=0,digitHit=0,endOfCol=0,counter,displacement=0;

		node = table->address;

		while(node != NULL)
		{
			currentNode = node;
			while(currentNode->left != NULL)
			{
				currentNode = currentNode->left;
			}

			while(currentNode->right != NULL)
			{
				nextNode = currentNode->right;
				while(digitHit == 0)
				{
					if(nextNode->data == 0)
					{
						if(nextNode->right != NULL)
						{
							nextNode = nextNode->right;
						}
						else{
							endOfCol = 1;
							break;
						}

					}
					else{
						digitHit = 1;
					}
				}

				if(endOfCol == 0)
				{
					while(nextNode->left != currentNode)
					{
						(nextNode->left)->data = nextNode->data;
						nextNode->data = 0;
						nextNode = nextNode->left;
                        displacement = 1;
					}

					if(currentNode->data == 0)
					{
						currentNode->data = nextNode->data;
						nextNode->data = 0;
					}

                    if(nextNode->data == currentNode->data)
					{
						if(match == 0)
						{
							currentNode->data = (nextNode->data)*2;
							nextNode->data = 0;
							score = score + currentNode->data;
							match = 1;
							displacement = 1;
						}
						else{
							match = 0;
						}
					}
                    if((currentNode->right) != NULL)
					{
                        if((currentNode->right)->data !=0)
                            currentNode = nextNode;
					}
					digitHit = 0;
					endOfCol = 0;
				}
				else
				{
					digitHit = 0;
					endOfCol = 0;
					break;
				}
			}
            match = 0;
			node = node->down;

		}
		return displacement;
}


int shift_Left()
{
		struct Node *currentNode , *nextNode;
		int match=0,digitHit=0,endOfCol=0,counter,displacement=0;

		node = table->address;

		while(node != NULL)
		{
			currentNode = node;

			while(currentNode->left != NULL)
			{
				nextNode = currentNode->left;
				while(digitHit == 0)
				{
					if(nextNode->data == 0)
					{
						if(nextNode->left != NULL)
						{
							nextNode = nextNode->left;
						}
						else{
							endOfCol = 1;
							break;
						}

					}
					else{
						digitHit = 1;
					}
				}

				if(endOfCol == 0)
				{
					while(nextNode->right != currentNode)
					{
						(nextNode->right)->data = nextNode->data;
						nextNode->data = 0;
						nextNode = nextNode->right;
						displacement = 1;
					}

					if(currentNode->data == 0)
					{
						currentNode->data = nextNode->data;
						nextNode->data = 0;
					}

					if(nextNode->data == currentNode->data)
					{
						if(match == 0)
						{
							currentNode->data = (nextNode->data)*2;
							nextNode->data = 0;
							score = score + currentNode->data;
							match = 1;
							displacement = 1;
						}
						else{
							match = 0;
						}
					}
					if((currentNode->left)->data !=0)
						currentNode = nextNode;
					digitHit = 0;
					endOfCol = 0;
				}
				else
				{
					digitHit = 0;
					endOfCol = 0;
					break;
				}
			}
            match = 0;
			node = node->down;

		}
		return displacement;
}




int shift_Up()
{
		struct Node *currentNode , *nextNode;
		int match=0,digitHit=0,endOfCol=0,counter,displacement=0;

		node = table->address;

		while(node != NULL)
		{
			currentNode = node;

			while(currentNode->down != NULL)
			{
				nextNode = currentNode->down;
				while(digitHit == 0)
				{
					//for(counter=0;counter<LIMIT;counter++);
					//printf("\nwaiting for digit to hit making right move...");
					if(nextNode->data == 0)
					{
						if(nextNode->down != NULL)
						{
							nextNode = nextNode->down;
						}
						else{
							endOfCol = 1;
							//for(counter=0;counter<LIMIT;counter++);
							//printf("\nin end of col...");
							break;
						}

					}
					else{
						digitHit = 1;
						/*for(counter=0;counter<LIMIT;counter++);
						printf("\nout of list...\n");*/
					}
				}

				if(endOfCol == 0)
				{
					while(nextNode->up != currentNode)
					{
						//for(counter=0;counter<LIMIT;counter++);
						//printf("\nbringing back the next pointer...\n");
						(nextNode->up)->data = nextNode->data;
						nextNode->data = 0;
						nextNode = nextNode->up;
						displacement = 1;
					}

					if(currentNode->data == 0)
					{
						currentNode->data = nextNode->data;
						nextNode->data = 0;
					}

					if(nextNode->data == currentNode->data)
					{
						if(match == 0)
						{
							currentNode->data = (nextNode->data)*2;
							nextNode->data = 0;
							score = score + currentNode->data;
							match = 1;
							displacement = 1;
						}
						else{
							match = 0;
						}
					}
					if((currentNode->down)->data !=0)
						currentNode = nextNode;
					digitHit = 0;
					endOfCol = 0;
				}
				else
				{
					digitHit = 0;
					endOfCol = 0;
					break;
				}
			}
            match = 0;
			node = node->left;
        }
        return displacement;
}



int shift_Down()
{
		struct Node *currentNode , *nextNode;
		int match=0,digitHit=0,endOfCol=0,counter,displacement=0;

		node = table->address;

		while(node != NULL)
		{
			currentNode = node;
			while(currentNode->down != NULL)
			{
				//for(counter=0;counter<LIMIT;counter++);
				//printf("\nMaking left iteration...");
				currentNode = currentNode->down;
			}

			while(currentNode->up != NULL)
			{
				nextNode = currentNode->up;
				while(digitHit == 0)
				{
					//for(counter=0;counter<LIMIT;counter++);
					//printf("\nwaiting for digit to hit making right move...");
					if(nextNode->data == 0)
					{
						if(nextNode->up != NULL)
						{
							nextNode = nextNode->up;
						}
						else{
							endOfCol = 1;
							//for(counter=0;counter<LIMIT;counter++);
							//printf("\nin end of col...");
							break;
						}

					}
					else{
						digitHit = 1;
						//for(counter=0;counter<LIMIT;counter++);
						//printf("\nout of list...\n");
					}
				}

				if(endOfCol == 0)
				{
					while(nextNode->down != currentNode)
					{
						//for(counter=0;counter<LIMIT;counter++);
						//printf("\nbringing back the next pointer...\n");
						(nextNode->down)->data = nextNode->data;
						nextNode->data = 0;
						nextNode = nextNode->down;
                        displacement = 1;
					}
					if(currentNode->data == 0)
					{
						currentNode->data = nextNode->data;
						nextNode->data = 0;
					}
					if(nextNode->data == currentNode->data)
					{
						if(match == 0)
						{
							currentNode->data = (nextNode->data)*2;
							nextNode->data = 0;
							score = score + currentNode->data;
							match = 1;
							displacement = 1;

						}
						else{
							match = 0;
						}
					}
					if((currentNode->up)->data !=0)
						currentNode = nextNode;
					digitHit = 0;
					endOfCol = 0;
				}
				else
				{
					digitHit = 0;
					endOfCol = 0;
					break;
				}
			}
            match = 0;
			node = node->left;

		}
		return displacement;
}


int generate_number()
{
	static int counter=-1;
	static int randomArray[20] = {2,2,2,2,4,2,2,2,4,4,2,4,2,2,4,2,2,2,4,2};
	//printf("\nIn generate number 2");
	counter++;
	//printf("\nIn generate number 3");
	counter = counter%20 ;
	//printf("\nIn generate number 4");

	return (randomArray[counter]);
}


struct Node* look_node(int row,int col)
{
	static int startNode=0;
	struct Node *node;
	int movement=0;
	startNode = startNode%4;
	if(startNode == 0)
	{
		node  = table->address;
		//printf("\nIn startNode 0");
		while(node!=NULL)
		{
			while(node != NULL)
			{
				if(node->data == 0)
				{
				    //printf("\nIn node found...\n");
				    startNode++;
					return node;
				}
				if(movement == 0)
				{
				    if(node->left != NULL)
                        node = node->left;
                    else
                        break;
				}
				else
				{
				    if(node->right != NULL)
                        node = node->right;
                    else
                        break;

				}

			}
			if(movement == 0)
			{
				movement = 1;
			}
			else
			{
				movement = 0;
			}
			node = node->down;
		}
	}

   else  if(startNode == 1)
	{
		node = (table + (col-1))->address;
		//printf("\nIn startNode 1");
		while(node!=NULL)
		{
           // printf("In 1...");
			while(node != NULL)
			{
			   // printf("\nIn 2...");
				if(node->data == 0)
				{
				  //  printf("\nIn node found...\n");
					startNode++;
					return node;
				}

				if(movement == 0)
				{
					if(node->right != NULL)
                        node = node->right;
                    else
                        break;

				}
				else
				{
					if(node->left != NULL)
                        node = node->left;
                    else
                        break;
				}
			}
			if(movement == 0)
			{
				movement = 1;
			}
			else
			{
				movement = 0;
			}
			node = node->down;
		}
	}

	else if(startNode == 2)
	{
		node = (table + ((col*row)-col))->address;
		//printf("\nIn startNode 2");
		while(node!=NULL)
		{
			while(node != NULL)
			{
				if(node->data == 0)
				{
				    //printf("\nIn node found...\n");
					startNode++;
					return node;
				}

				if(movement == 0)
				{
					if(node->left != NULL)
                        node = node->left;
                    else
                        break;

				}
				else
				{
					if(node->right != NULL)
                        node = node->right;
                    else
                        break;
				}
			}
			if(movement == 0)
			{
				movement = 1;
			}
			else
			{
				movement = 0;
			}
			node = node->up;
		}
	}

	else if(startNode == 3)
	{
		node = (table +((col*row)-1))->address;
		//printf("\nIn startNode 3");
		while(node!=NULL)
		{
			while(node != NULL)
			{
				if(node->data == 0)
				{
				   // printf("\nIn node found...\n");
					startNode++;
					return node;
				}

				if(movement == 0)
				{
					if(node->right != NULL)
                        node = node->right;
                    else
                        break;


				}
				else
				{
                    if(node->left != NULL)
                        node = node->left;
                    else
                        break;
				}
			}
			if(movement == 0)
			{
				movement = 1;
			}
			else
			{
				movement = 0;
			}
			node = node->up;
		}
	}

	return NULL;
}


char is_game_over()
{
	struct Node *horizontalNode,*verticalNode,*tempNode;
	horizontalNode = verticalNode = table->address;
//	printf("\nHi in game over\n");
	while(horizontalNode != NULL)
	{
	//	printf("\nIn horizontal\n");
		tempNode = horizontalNode;
		while(tempNode != NULL)
		{
			if(tempNode->left != NULL)
			{
				if(((tempNode->data) == ((tempNode->left)->data)) || tempNode->data == 0)
				{
					return 'n';
				}
			}
			tempNode = tempNode->left;
		}
		horizontalNode = horizontalNode->down;
	}


	while(verticalNode != NULL)
	{
		//printf("\nIn vertical\n");
		tempNode = verticalNode;
		while(tempNode != NULL)
		{
			if(tempNode->down != NULL)
			{
				if(((tempNode->data) == ((tempNode->down)->data)) || tempNode->data == 0)
				{
					return 'n';
				}
			}
			tempNode = tempNode->down;
		}
		verticalNode = verticalNode->left;
	}

	return 'y';
}


char compare(char *string1, char *string2)
{
    int counter;
    counter = 0;

    while(string1[counter]!='\0' && string2[counter]!= '\0')
    {
        if(string1[counter] == string2[counter])
        {
            counter++;
        }
        else
        {
            return 'n';
        }
    }
    if(string1[counter]=='\0' && string2[counter]== '\0')
    {
        return 'y';
    }
    else
    {
        return 'n';
    }
}


void leaders_board()
{
    FILE *playersList,*leadersBoard,*playerFile,*hScore;
    struct leadersBoardList *head,*Lnode;
    char file_type[10] = {'.','t','x','t'};
    char playerName[50],playerNameFile[50],ch;
    int score,counter;
    head = NULL;
    if((playersList = fopen("playersNameList.txt","r")) == NULL)
    {
        printf("\nError opening file terminating game\nError Label: LB\n");
        exit(1);
    }

    while(!feof(playersList))
    {
        Lnode = create_leaders_node();
        Lnode->backLink = NULL ;
        Lnode->forwardLink = NULL ;
        counter = -1;
        do{
            counter++;
            playerName[counter] = fgetc(playersList);
        }while((playerName[counter]!='\0') && (!feof(playersList)));
        strcpy(playerNameFile,playerName);
        strcat(playerNameFile,file_type);
        if((playerFile = fopen(playerNameFile,"r")) != NULL)
        {
        fscanf(playerFile,"%d",&score);
        strcpy(Lnode->playerName,playerName);
        Lnode->score = score;
        attach_Lnode( &head , Lnode );
        }
        fclose(playerFile);
        fgetc(playersList);
    }
    fclose(playersList);
    leadersBoard = fopen("leadersBoardFile.txt","w");
    Lnode = head;
    hScore = fopen("highScore.txt","w");
    fprintf(hScore,"%d",Lnode->score);
    fclose(hScore);
    while(Lnode != NULL)
    {
        fprintf(leadersBoard,"%s#%d\n",Lnode->playerName,Lnode->score);
        Lnode = Lnode->forwardLink;
    }
    fclose(leadersBoard);
    release_list(&head);
}


struct leadersBoardList* create_leaders_node()
{
    return ((struct leadersBoardList*)malloc(sizeof(struct leadersBoardList)));

}

void attach_Lnode( struct leadersBoardList **head , struct leadersBoardList *Lnode )
{
    struct leadersBoardList *tmpNode;
    int headFlag=0,attachedElse=0;
    if(*head == NULL)
    {
        *head = Lnode;
    }
    else
    {
        tmpNode = *head;

        while(tmpNode->forwardLink != NULL)
        {
            if(tmpNode->score < Lnode->score)
            {
               headFlag = addBefore(Lnode , tmpNode);
               if(headFlag == 1)
               {
                   *head = Lnode;
               }
               attachedElse = 1;
               break;
            }
            else
            {
                 tmpNode = tmpNode->forwardLink;
            }
        }
        if(attachedElse != 1)
        {
            if(tmpNode->score < Lnode->score)
            {
                headFlag = addBefore(Lnode , tmpNode);
                if(headFlag == 1)
                {
                    *head = Lnode;
                }
            }
            else
            {
                addAfter(tmpNode , Lnode);
            }
        }
        attachedElse = 0;
    }
}

static int addBefore(struct leadersBoardList *Lnode , struct leadersBoardList *tmp)
{
    struct leadersBoardList *var;
    if(tmp->backLink != NULL)
    {
        var = tmp->backLink;
        var->forwardLink = Lnode;
        tmp->backLink = Lnode;
        Lnode->backLink = var;
        Lnode->forwardLink = tmp;
    }
    else
    {
        tmp->backLink = Lnode;
        Lnode->forwardLink = tmp;
        return(1);
    }

    return(0);
}


static void addAfter(struct leadersBoardList *tmp , struct leadersBoardList *Lnode)
{
    tmp->forwardLink = Lnode;
    Lnode->backLink = tmp;
}

void release_list(struct leadersBoardList **head)
{
    struct leadersBoardList *node , *tmp;

    node = *head;

    while(node->forwardLink != NULL)
    {
        tmp = node;
        node = node->forwardLink;
        *head = node;
        free(tmp);
    }
    free(*head);
}
