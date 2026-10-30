#include "YunxiuStudyGameMode.h"
#include "YunxiuStudyPawn.h"
#include "YunxiuStudyTerrain.h"
#include "EngineUtils.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
AYunxiuStudyGameMode::AYunxiuStudyGameMode(){DefaultPawnClass=AYunxiuStudyPawn::StaticClass();}
void AYunxiuStudyGameMode::StartPlay()
{
    Super::StartPlay();
    AYunxiuStudyTerrain* Terrain=nullptr;
    for(TActorIterator<AYunxiuStudyTerrain> It(GetWorld());It;++It){Terrain=*It;break;}
    if(!Terrain) Terrain=GetWorld()->SpawnActor<AYunxiuStudyTerrain>();
    if(!Terrain || !Terrain->BuildReferenceTerrain()) return;
    if(APlayerController* PC=GetWorld()->GetFirstPlayerController())
    if(APawn* Pawn=PC->GetPawn())
    {
        // Temporary inspection spawn; does not move any frozen map feature.
        const double H=Terrain->HeightAtLocalMetres(-100,-80);
        if(FMath::IsFinite(H)) Pawn->SetActorLocation(FVector(-10000,-8000,H*100+200));
    }
}
