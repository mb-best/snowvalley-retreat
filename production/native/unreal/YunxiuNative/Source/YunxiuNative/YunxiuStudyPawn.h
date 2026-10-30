#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "YunxiuStudyPawn.generated.h"
UCLASS()
class YUNXIUNATIVE_API AYunxiuStudyPawn : public ACharacter
{
    GENERATED_BODY()
public:
    AYunxiuStudyPawn();
protected:
    virtual void SetupPlayerInputComponent(UInputComponent* Input) override;
    void Forward(float Value);
    void Right(float Value);
    void Turn(float Value);
    void Look(float Value);
};
