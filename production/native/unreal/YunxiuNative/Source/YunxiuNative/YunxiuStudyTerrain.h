#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "YunxiuStudyTerrain.generated.h"
class UProceduralMeshComponent;
UCLASS()
class YUNXIUNATIVE_API AYunxiuStudyTerrain : public AActor
{
    GENERATED_BODY()
public:
    AYunxiuStudyTerrain();
    UFUNCTION(CallInEditor, BlueprintCallable, Category="Yunxiu")
    bool BuildReferenceTerrain();
    UFUNCTION(BlueprintPure, Category="Yunxiu")
    double HeightAtLocalMetres(double East, double South) const;
protected:
    virtual void BeginPlay() override;
private:
    UPROPERTY(VisibleAnywhere) TObjectPtr<UProceduralMeshComponent> Mesh;
    TArray<float> Heights;
    static constexpr int32 Columns = 201;
    static constexpr int32 Rows = 201;
    static constexpr double Spacing = 5.0;
};
