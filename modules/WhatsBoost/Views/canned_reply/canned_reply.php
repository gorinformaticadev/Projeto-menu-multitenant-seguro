<?php echo form_open(
    get_uri("whatsboost/save_canned_replies"),
    array("id" => "canned-form", "class" => "canned-form", "role" => "form"),
    ['id' => $model_info['id'] ?? '']
); ?>
<div class="modal-body clearfix">
    <div class="container-fluid">
        <div class="form-group">
            <div class="row mt-3">
                <label for="title" class="form-label">
                    <span class="text-danger mr5">*</span>
                    <?php echo app_lang('title'); ?>
                </label>
                <div class="col-md-12">
                    <?php
                    echo form_input(array(
                        "id"                  => "title",
                        "name"                => "title",
                        "value"               => $model_info['title'] ?? '',
                        "class"               => "form-control validate-hidden",
                        "placeholder"         => app_lang('title'),
                        "autofocus"           => true,
                        "data-rule-required"  => true,
                        "data-msg-required"   => app_lang("field_required"),
                    ));
                    ?>
                </div>
            </div>
        </div>

        <div class="form-group">
            <div class="row mt-3">
                <label for="description" class="form-label">
                    <span class="text-danger mr5">*</span>
                    <?php echo app_lang('description'); ?>
                </label>
                <div class="col-md-12">
                    <?php
                    echo form_textarea(array(
                        "name"                  => "description",
                        "value"                 => $model_info['description'] ?? '',
                        "class"                 => "form-control",
                        "style"                 => "height: 150px;",
                        "placeholder"           => app_lang('description'),
                        "data-rule-required"    => true,
                        "data-msg-required"     => app_lang("field_required"),
                        "data-rich-text-editor" => true
                    ));
                    ?>
                </div>
            </div>
        </div>
    </div>
</div>

<div class="modal-footer">
    <button type="button" class="btn btn-default" data-bs-dismiss="modal">
        <span data-feather="x" class="icon-16"></span>
        <?php echo app_lang('close'); ?>
    </button>
    <button type="submit" class="btn btn-primary">
        <span data-feather="check-circle" class="icon-16"></span>
        <?php echo app_lang('save'); ?>
    </button>
</div>
<?php echo form_close(); ?>

<script type="text/javascript">
    $(document).ready(function() {
        window.projectForm = $("#canned-form").appForm({
            closeModalOnSuccess: false,
            onSuccess: function(response) {
                if (response.type === 'success') {
                    appAlert.success(response.message, {
                        duration: 10000
                    });
                } else {
                    appAlert.error(response.message, {
                        duration: 10000
                    });
                }

                window.projectForm.closeModal();
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }
        });
    });
</script>