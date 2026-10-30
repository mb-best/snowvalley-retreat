#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "YunxiuStudyGameMode.generated.h"
UCLASS()
class YUNXIUNATIVE_API AYunxiuStudyGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AYunxiuStudyGameMode();
    virtual void StartPlay() override;
};
